import { NextRequest, NextResponse } from 'next/server';
import type { SessionSummaryPayload, RawHeartData, UserBaseline, PhaseData, SessionSummaryRecord } from '@/types';
import {
    calculateRMSSD,
    calculateSDNN,
    calculatePNN50,
    calculateMeanHR,
    calculateMxDMn,
    calculateAMoMetrics,
    calculateHTI
} from '@/utils/hrvCalculations';
import { calculateFrequencyDomain } from '@/utils/frequencyDomain';
import { calculatePoincareMetrics } from '@/utils/poincare';
import { calculateBaevskyMetrics } from '@/utils/baevsky';
import { calculateHrvScore, calculateFourScores } from '@/utils/scoreCalculations';
import { calculateHrvReadinessScore } from '@/utils/baselineCalculations';
import { autoCheckAndUpdateBaseline } from '@/utils/autoBaselineCheck';
import { getAdminPb } from '@/lib/pbAdmin';
import {
    START_END_WINDOW_SECONDS,
    flattenRrSeries,
    computeTimeToStabilize,
    computeRespCoherenceScore,
    computeRestorationIndex,
    computeHrvStability,
} from '@/utils/sessionProcessing';
import { buildSessionSummary } from '@/utils/buildSessionSummary';
import { withDollarId } from '@/lib/pbMap';
import { interpretHRVSession, InterpretationResult } from '@/utils/autonomicInterpretation';
import {
    generateScoreBasedInterpretation,
    generateCalibrationInterpretation,
    findComparisonSession
} from '@/utils/sessionComparison';
import * as fflate from 'fflate';

// --- CSV / ZIP HELPER FUNCTIONS (Moved from Frontend) ---
const CSV_HEADERS = ['timestamp', 'heartRate', 'rrInterval', 'rawValue', 'flags', 'rawBytes', 'allRrIntervals'] as const;
type CsvHeaderKey = typeof CSV_HEADERS[number];

const formatCsvValue = (value: unknown): string => {
    if (value === undefined || value === null) return '';
    let normalized: string;
    if (Array.isArray(value) || typeof value === 'object') {
        normalized = JSON.stringify(value);
    } else {
        normalized = String(value);
    }
    if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
};

const buildSessionCsv = (
    finalRawData: RawHeartData[],
    metadata: { startTime: string | null; endTime: string; duration: number; dataPoints: number }
) => {
    const lines = [
        `# sessionStartTime=${metadata.startTime ?? ''}`,
        `# sessionEndTime=${metadata.endTime}`,
        `# durationSeconds=${metadata.duration}`,
        `# dataPoints=${metadata.dataPoints}`,
        CSV_HEADERS.join(',')
    ];

    for (const entry of finalRawData) {
        const record = entry as Record<CsvHeaderKey, unknown>;
        const row = CSV_HEADERS.map((header) => formatCsvValue(record[header]));
        lines.push(row.join(','));
    }

    return lines.join('\n');
};
// --------------------------------------------------------

interface SummaryMetricOptions {
    rawData: RawHeartData[];
    sessionStartTime: string | null;
    durationSeconds: number;
    userId: string;
    sessionId: string;
}

// Helper function to calculate SD2/SD1 balance metrics
const calculateBalanceMetrics = (sd1: number | null, sd2: number | null): {
    sd2_sd1_ratio: number | null;
    balanceIndexX: number | null;
    normalizedBalanceScore: number | null;
    parasympatheticPercent: number | null;
    sympatheticPercent: number | null;
} => {
    const BALANCE_DOMAIN: readonly [number, number] = [0, 200] as const;
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const sd2_sd1_ratio = (sd1 !== null && sd1 !== undefined && sd2 !== null && sd2 !== undefined && sd1 > 1e-6)
        ? Number((sd2 / sd1).toFixed(4))
        : null;

    let balanceIndexX: number | null = null;
    if (sd2_sd1_ratio !== null && sd2_sd1_ratio > 0) {
        const rawBalance = 100 + (Math.log10(sd2_sd1_ratio) / Math.log10(10)) * 35;
        balanceIndexX = Number(clamp(rawBalance, BALANCE_DOMAIN[0], BALANCE_DOMAIN[1]).toFixed(1));
    }

    let normalizedBalanceScore: number | null = null;
    let parasympatheticPercent: number | null = null;
    let sympatheticPercent: number | null = null;

    if (balanceIndexX !== null) {
        normalizedBalanceScore = Number((balanceIndexX / 2).toFixed(1));
        parasympatheticPercent = normalizedBalanceScore;
        sympatheticPercent = Number((100 - normalizedBalanceScore).toFixed(1));
    }

    return {
        sd2_sd1_ratio,
        balanceIndexX,
        normalizedBalanceScore,
        parasympatheticPercent,
        sympatheticPercent
    };
};

// Main computation function
const computeSessionSummaryPayload = async ({
    rawData,
    sessionStartTime,
    durationSeconds,
    userId,
    sessionId,
}: SummaryMetricOptions): Promise<SessionSummaryPayload> => {
    const sessionStartTimestamp = sessionStartTime ? Date.parse(sessionStartTime) : (rawData[0]?.timestamp ?? Date.now());
    const rrSeries = flattenRrSeries(rawData, sessionStartTimestamp);
    const rrValues = rrSeries.map((item) => item.value);

    // Calculate time-domain metrics
    const rmssdSession = calculateRMSSD(rrValues);
    const sdnnSession = calculateSDNN(rrValues);
    const pnn50 = calculatePNN50(rrValues);
    const meanHr = calculateMeanHR(rrValues);
    const { amode50, AMo50Count } = calculateAMoMetrics(rrValues);
    const mxDmN = calculateMxDMn(rrValues);
    const rrMax = rrValues.length ? Math.max(...rrValues) : null;
    const rrMin = rrValues.length ? Math.min(...rrValues) : null;
    const meanRR = rrValues.length ? rrValues.reduce((sum, rr) => sum + rr, 0) / rrValues.length : null;

    // Calculate frequency domain metrics
    const frequencyMetrics = calculateFrequencyDomain(rrValues);

    // Calculate Poincaré plot metrics
    const poincareMetrics = calculatePoincareMetrics(rrValues);
    const balanceMetrics = calculateBalanceMetrics(poincareMetrics.sd1, poincareMetrics.sd2);

    // Calculate Baevsky metrics
    const baevskyMetrics = calculateBaevskyMetrics(rrValues);

    // Calculate HTI (HRV Triangular Index)
    const hti = calculateHTI(rrValues);

    // Calculate windowed RMSSD for start/end
    const windowMs = START_END_WINDOW_SECONDS * 1000;
    const endTimestamp = rrSeries.length ? rrSeries[rrSeries.length - 1].timestamp : sessionStartTimestamp + durationSeconds * 1000;
    const startWindow = rrSeries.filter((sample) => sample.timestamp <= sessionStartTimestamp + windowMs).map((sample) => sample.value);
    const endWindow = rrSeries.filter((sample) => sample.timestamp >= endTimestamp - windowMs).map((sample) => sample.value);

    const rmssdStart = startWindow.length >= 2 ? calculateRMSSD(startWindow) : null;
    const rmssdEnd = endWindow.length >= 2 ? calculateRMSSD(endWindow) : null;

    // Calculate complex metrics
    const timeToStabilize = computeTimeToStabilize(rawData, sessionStartTimestamp, meanHr);
    const respCoherence = computeRespCoherenceScore(rmssdSession, sdnnSession, pnn50);
    const hrvStability = computeHrvStability(rrSeries, sessionStartTimestamp, calculateRMSSD, calculateSDNN, calculateMeanHR);

    let sessionStressIndex: number | null = null;
    if (amode50 !== null && mxDmN && mxDmN !== 0) {
        sessionStressIndex = Number(((amode50 / mxDmN) * 100).toFixed(2));
    }

    const restorationIndex = computeRestorationIndex(rmssdSession, respCoherence, timeToStabilize);

    // Calculate the 4 main scores
    const fourScores = calculateFourScores({
        rmssd: rmssdSession,
        sdnn: sdnnSession,
        meanHR: meanHr,
        bsi: baevskyMetrics.bsi,
        totalPower: frequencyMetrics.totalPower,
        sleepRecovery: 0.6,
        shortTermRRStd: null,
        sd1: poincareMetrics.sd1,
        sd2: poincareMetrics.sd2,
        hti: hti
    });

    // Fetch user's baseline for personalized HRV Readiness Score
    let userBaseline: UserBaseline | null = null;
    try {
        const pb = await getAdminPb();
        const baseline = await pb.collection('user_baselines').getFirstListItem(
            `user_id = "${userId}"`
        );
        userBaseline = {
            $id: baseline.id,
            user_id: baseline.user_id,
            rmssd_avg: baseline.rmssd_avg,
            rmssd_stdev: baseline.rmssd_stdev,
            sdnn_avg: baseline.sdnn_avg,
            sdnn_stdev: baseline.sdnn_stdev,
            hr_avg: baseline.hr_avg,
            hr_stdev: baseline.hr_stdev,
            sd1_sd2_ratio_avg: baseline.sd1_sd2_ratio_avg,
            sd1_sd2_ratio_stdev: baseline.sd1_sd2_ratio_stdev,
            sessions_count: baseline.sessions_count,
            established: baseline.established,
            unique_morning_sessions_count: baseline.unique_morning_sessions_count,
            calibration_progress: baseline.calibration_progress,
            last_updated: baseline.last_updated,
            createdAt: baseline.created
        };
    } catch (error: unknown) {
        const err = error as { status?: number };
        if (err.status !== 404) {
            console.error('Error fetching user baseline:', error);
        }
    }

    // ALWAYS calculate fallback HRV score first (for users without baseline)
    const fallbackHrvScore = calculateHrvScore({
        rmssd: rmssdSession,
        sdnn: sdnnSession,
        meanHR: meanHr,
        rmssdStart,
        rmssdEnd,
        coherence: respCoherence,
        restoration: restorationIndex
    });

    // Try to calculate personalized HRV Readiness Score if baseline exists
    const hrvScore: number | null = fallbackHrvScore;
    let readinessScore: number | null = null;
    let isCrash = false;

    if (userBaseline && userBaseline.established) {
        const personalizedScore = calculateHrvReadinessScore({
            rmssd: rmssdSession,
            sdnn: sdnnSession,
            meanHR: meanHr,
            sd1: poincareMetrics.sd1,
            sd2: poincareMetrics.sd2
        }, userBaseline);

        if (personalizedScore !== null) {
            readinessScore = personalizedScore;

            if (personalizedScore < 10) {
                isCrash = true;
            }
        }
    }

    return {
        session_id: sessionId,
        user_id: userId,
        rmssd_session_ms: rmssdSession !== null ? Number(rmssdSession.toFixed(2)) : null,
        rmssd_cv_percent: hrvStability !== null ? Number(hrvStability.toFixed(2)) : null,
        sdnn_session_ms: sdnnSession !== null ? Number(sdnnSession.toFixed(2)) : null,
        pnn50_percent: pnn50 !== null ? Number(pnn50.toFixed(2)) : null,
        session_mean_hr: meanHr !== null ? Number(meanHr.toFixed(2)) : null,
        amode_50: amode50 !== null ? Number(amode50.toFixed(2)) : null,
        AMo50_count: AMo50Count,
        rr_max_ms: rrMax !== null ? Math.round(rrMax) : null,
        rr_min_ms: rrMin !== null ? Math.round(rrMin) : null,
        mxdmn_ms: mxDmN !== null ? Math.round(mxDmN) : null,
        rmssd_start_ms: rmssdStart !== null ? Number(rmssdStart.toFixed(2)) : null,
        rmssd_end_ms: rmssdEnd !== null ? Number(rmssdEnd.toFixed(2)) : null,
        time_to_stabilize_seconds: timeToStabilize,
        resp_coherence_score: respCoherence,
        restoration_index: restorationIndex,
        session_stress_index: sessionStressIndex,
        mean_rr_ms: meanRR !== null ? Number(meanRR.toFixed(2)) : null,
        lf_power_ms2: frequencyMetrics.lfPower,
        hf_power_ms2: frequencyMetrics.hfPower,
        lfhf_ratio: frequencyMetrics.lfhfRatio,
        total_power_ms2: frequencyMetrics.totalPower,
        sd1_ms: poincareMetrics.sd1,
        sd2_ms: poincareMetrics.sd2,
        sd2_sd1_ratio: balanceMetrics.sd2_sd1_ratio,
        sd1_sd2_balance_score_nbs: balanceMetrics.normalizedBalanceScore,
        sd1_sd2_parasympathetic_percent: balanceMetrics.parasympatheticPercent,
        sd1_sd2_sympathetic_percent: balanceMetrics.sympatheticPercent,
        baevsky_mo: baevskyMetrics.mo,
        baevsky_amo: baevskyMetrics.amo,
        baevsky_mxdmn_ms: baevskyMetrics.mxdmn,
        baevsky_stress_index: baevskyMetrics.bsi,
        energy_score: fourScores.energyScore,
        stress_score: fourScores.stressScore,
        health_score: fourScores.healthScore,
        focus_score: fourScores.focusScore,
        hrv_score: hrvScore,
        readiness_score: readinessScore,
        is_crash: isCrash,
    };
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { rawData, sessionStartTime, durationSeconds, userId, rrQualityData } = body;

        if (!rawData || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields: rawData, userId' },
                { status: 400 }
            );
        }

        const pb = await getAdminPb();
        let finalSessionId = body.sessionId;
        const isGuest = userId === 'guest' || userId.startsWith('guest');

        // =====================================================================
        // 1. CREATE SESSION RECORD (Server-Side)
        // =====================================================================
        if (!isGuest) {
            try {
                // Generate CSV
                const endTime = new Date(new Date(sessionStartTime).getTime() + (durationSeconds * 1000)).toISOString();
                const csvContent = buildSessionCsv(rawData, {
                    startTime: sessionStartTime,
                    endTime: endTime,
                    duration: durationSeconds,
                    dataPoints: rawData.length
                });

                // Zip it
                const timestamp = Date.now();
                const zipData = fflate.zipSync({ [`session-${timestamp}.csv`]: fflate.strToU8(csvContent) });

                // Create File object
                const fileName = `session-${timestamp}.zip`;
                const file = new File([Buffer.from(zipData)], fileName, { type: 'application/zip' });

                // Create record in PocketBase
                const sessionRecord = await pb.collection('sessions').create({
                    userId: userId,
                    startTime: sessionStartTime,
                    endTime: endTime,
                    rawFile: file
                });

                finalSessionId = sessionRecord.id;
                console.log('✅ [API] Session record created:', finalSessionId);
            } catch (err) {
                console.error('❌ [API] Failed to create session record:', err);
                // Continue with analysis but mark as error
            }
        } else {
            // For guests, use a temp ID if not provided
            if (!finalSessionId) finalSessionId = `guest-${Date.now()}`;
        }

        // =====================================================================
        // 2. COMPUTE METRICS
        // =====================================================================
        const summaryPayload = await computeSessionSummaryPayload({
            rawData,
            sessionStartTime,
            durationSeconds: durationSeconds || 0,
            userId,
            sessionId: finalSessionId,
        });

        // =====================================================================
        // 3. BASELINE CHECK & PHASE
        // =====================================================================
        let phaseData: PhaseData | null = null;
        let updatedBaseline: UserBaseline | null = null;
        let isBaselineCreated = false;
        let isBaselineUpdated = false;

        if (!isGuest) {
            try {
                const currentSessionSummary = {
                    session_date: sessionStartTime || new Date().toISOString(),
                    rmssd_session_ms: summaryPayload.rmssd_session_ms
                };

                const baselineResult = await autoCheckAndUpdateBaseline(
                    userId,
                    finalSessionId,
                    currentSessionSummary
                );

                phaseData = {
                    name: baselineResult.phase,
                    progress: baselineResult.phaseProgress,
                    uniqueDays: baselineResult.uniqueDays,
                    isFirstSession: baselineResult.isFirstSession
                };

                isBaselineCreated = baselineResult.baselineCreated ?? false;
                isBaselineUpdated = baselineResult.baselineUpdated ?? false;

                // Fetch full baseline object
                try {
                    const baseline = await pb.collection('user_baselines').getFirstListItem(`user_id = "${userId}"`);
                    updatedBaseline = withDollarId(baseline) as unknown as UserBaseline;
                } catch { /* ignore 404 */ }

            } catch (error) {
                console.error('Baseline check failed:', error);
                phaseData = { name: 'calibration', progress: 0, uniqueDays: 0 };
            }
        }

        // =====================================================================
        // 4. GENERATE INTERPRETATION
        // =====================================================================
        let interpretation: InterpretationResult | null = null;
        try {
            const dataPointsCount = rawData.length > 0 ? rawData.length : Math.max(60, durationSeconds || 60);
            const builderPayload = { ...summaryPayload, phase: phaseData };
            const sessionSummary = buildSessionSummary(builderPayload, durationSeconds || 0, dataPointsCount, rawData, finalSessionId);
            const sessionDate = sessionStartTime ? new Date(sessionStartTime) : new Date();

            if (isGuest) {
                interpretation = generateScoreBasedInterpretation(sessionSummary, true);
            } else if (phaseData?.name === 'calibration') {
                const previousSessions = await pb.collection('session_summary').getList(1, 10, {
                    filter: `user_id = "${userId}" && session_id != "${finalSessionId}" && is_crash = false`,
                    sort: '-session_date'
                });
                const prevRecords = previousSessions.items.map(s => withDollarId(s)) as unknown as SessionSummaryRecord[];
                const comparisonResult = findComparisonSession(sessionDate, prevRecords);

                if (comparisonResult.session) {
                    interpretation = generateCalibrationInterpretation(
                        sessionSummary,
                        comparisonResult.session,
                        comparisonResult.insightText,
                        comparisonResult.metricTitle
                    );
                } else {
                    interpretation = generateScoreBasedInterpretation(sessionSummary, prevRecords.length === 0);
                }
            } else {
                if (updatedBaseline && updatedBaseline.established) {
                    interpretation = interpretHRVSession(sessionSummary, updatedBaseline);
                }
                if (!interpretation) interpretation = generateScoreBasedInterpretation(sessionSummary, false);
            }
        } catch (interpError) {
            console.error('[API] Interpretation generation failed:', interpError);
        }

        // =====================================================================
        // 5. SAVE SUMMARY RECORD (Server-Side)
        // =====================================================================
        if (!isGuest && finalSessionId) {
            try {
                await pb.collection('session_summary').create({
                    ...summaryPayload,
                    rr_quality_data: rrQualityData,
                    session_date: sessionStartTime,
                    session_id: finalSessionId
                });
                console.log('✅ [API] Session Summary record saved.');
            } catch (err) {
                console.error('❌ [API] Failed to save session summary:', err);
            }
        }

        const responseData = {
            ...summaryPayload,
            session_id: finalSessionId,
            phase: phaseData,
            baseline: updatedBaseline,
            interpretation: interpretation,
            isBaselineCreated,
            isBaselineUpdated
        };

        return NextResponse.json(responseData);

    } catch (error) {
        console.error('Error in session analysis API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
