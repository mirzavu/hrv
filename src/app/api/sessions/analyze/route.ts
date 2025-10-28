import { NextRequest, NextResponse } from 'next/server';
import type { SessionSummaryPayload, RawHeartData } from '@/types';
import {
  calculateRMSSD,
  calculateSDNN,
  calculatePNN50,
  calculateMeanHR,
  calculateMxDMn,
  calculateAMoMetrics
} from '@/utils/hrvCalculations';
import { calculateFrequencyDomain } from '@/utils/frequencyDomain';
import { calculatePoincareMetrics } from '@/utils/poincare';
import { calculateBaevskyMetrics } from '@/utils/baevsky';
import { calculateHrvScore, calculateFourScores } from '@/utils/scoreCalculations';
import {
  START_END_WINDOW_SECONDS,
  flattenRrSeries,
  computeTimeToStabilize,
  computeRespCoherenceScore,
  computeRestorationIndex,
  computeHrvStability,
  type TimestampedRR
} from '@/utils/sessionProcessing';

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
        // Formula: 100 + (log10(ratio) / log10(10)) * 35
        const rawBalance = 100 + (Math.log10(sd2_sd1_ratio) / Math.log10(10)) * 35;
        balanceIndexX = Number(clamp(rawBalance, BALANCE_DOMAIN[0], BALANCE_DOMAIN[1]).toFixed(1));
    }

    let normalizedBalanceScore: number | null = null;
    let parasympatheticPercent: number | null = null;
    let sympatheticPercent: number | null = null;

    if (balanceIndexX !== null) {
        // NBS = X / 2 (Normalizes 0-200 scale to 0-100)
        normalizedBalanceScore = Number((balanceIndexX / 2).toFixed(1));
        
        // Direct mapping: 
        // X=128 -> NBS=64 -> 64% Parasympathetic
        // X=72  -> NBS=36 -> 36% Parasympathetic
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
const computeSessionSummaryPayload = ({
    rawData,
    sessionStartTime,
    durationSeconds,
    userId,
    sessionId,
}: SummaryMetricOptions): SessionSummaryPayload => {
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
    const hrvStability = computeHrvStability(rrSeries, sessionStartTimestamp, calculateRMSSD);

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
        sd2: poincareMetrics.sd2
    });

    // Calculate overall HRV score
    const hrvScore = calculateHrvScore({
        rmssd: rmssdSession,
        sdnn: sdnnSession,
        meanHR: meanHr,
        rmssdStart,
        rmssdEnd,
        coherence: respCoherence,
        restoration: restorationIndex
    });

    return {
        session_id: sessionId,
        user_id: userId,
        rmssd_session_ms: rmssdSession !== null ? Number(rmssdSession.toFixed(2)) : null,
        ...(hrvStability !== null && { rmssd_cv_percent: hrvStability }),
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
    };
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { rawData, sessionStartTime, durationSeconds, userId, sessionId } = body;

        if (!rawData || !userId || !sessionId) {
            return NextResponse.json(
                { error: 'Missing required fields: rawData, userId, sessionId' },
                { status: 400 }
            );
        }

        const summaryPayload = computeSessionSummaryPayload({
            rawData,
            sessionStartTime,
            durationSeconds: durationSeconds || 0,
            userId,
            sessionId,
        });

        return NextResponse.json(summaryPayload);
    } catch (error) {
        console.error('Error in session analysis API:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
