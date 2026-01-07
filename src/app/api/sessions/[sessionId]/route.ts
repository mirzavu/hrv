import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';
import { buildSessionSummary } from '@/utils/buildSessionSummary';
import { SessionSummaryPayload, SessionSummaryRecord, UserBaseline } from '@/types';
import * as fflate from 'fflate';
import { interpretHRVSession, InterpretationResult } from '@/utils/autonomicInterpretation';
import {
  generateScoreBasedInterpretation,
  generateCalibrationInterpretation,
  findComparisonSession
} from '@/utils/sessionComparison';
import { formatDateForPocketBase, toLocalDateString, DEFAULT_TIMEZONE } from '@/utils/dateUtils';

// GET /api/sessions/[sessionId] - Fetch full session data with summary AND interpretation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  try {
    // Handle both sync and async params (Next.js 14 vs 15)
    const resolvedParams = params instanceof Promise ? await params : params;
    const sessionId = resolvedParams.sessionId;
    const { searchParams } = new URL(request.url);
    // userId is optional but needed for interpretation
    const userId = searchParams.get('userId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Fetch session record to get duration and metadata
    let session;
    try {
      session = await pb.collection('sessions').getOne(sessionId);
    } catch (error) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch session summary
    const summaryResult = await pb.collection('session_summary').getList(1, 1, {
      filter: `session_id = "${sessionId}"`
    });

    if (summaryResult.items.length === 0) {
      return NextResponse.json({ error: 'Session summary not found' }, { status: 404 });
    }

    const summaryRecord = withDollarId(summaryResult.items[0]);

    // Calculate duration from session startTime and endTime
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    // Fetch and process raw data if available
    const rawData: Array<{ timestamp: number; rrInterval?: number; allRrIntervals?: number[] }> = [];

    if (session.rawFile) {
      try {
        const fileUrl = pb.files.getURL(session, session.rawFile);

        // Fetch the file
        const fileResponse = await fetch(fileUrl);
        if (fileResponse.ok) {
          const arrayBuffer = await fileResponse.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Unzip the file
          const unzipped = fflate.unzipSync(uint8Array);

          // Find the CSV file inside the zip (there should be only one)
          const csvFileName = Object.keys(unzipped).find(name => name.endsWith('.csv'));

          if (csvFileName) {
            const csvContent = fflate.strFromU8(unzipped[csvFileName]);
            const lines = csvContent.split('\n');

            // Find header line
            let headerIndex = -1;
            const dataLines = [];

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('#')) continue; // Skip comments
              if (!line) continue; // Skip empty lines

              if (headerIndex === -1) {
                headerIndex = i;
              } else {
                dataLines.push(line);
              }
            }

            if (headerIndex !== -1) {
              const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
              const rrIndex = headers.indexOf('rrInterval');
              const timestampIndex = headers.indexOf('timestamp');
              const allRrIndex = headers.indexOf('allRrIntervals');

              if (rrIndex !== -1 && timestampIndex !== -1) {
                // Parse data lines
                for (const line of dataLines) {
                  // Handle potential quoted CSV values (simple parser)
                  // For our simple CSV where arrays might be quoted "[1,2]"
                  let columns: string[] = [];
                  let inQuote = false;
                  let currentValue = '';

                  for (let c = 0; c < line.length; c++) {
                    const char = line[c];
                    if (char === '"') {
                      inQuote = !inQuote;
                    } else if (char === ',' && !inQuote) {
                      columns.push(currentValue);
                      currentValue = '';
                    } else {
                      currentValue += char;
                    }
                  }
                  columns.push(currentValue);

                  if (columns.length > rrIndex && columns.length > timestampIndex) {
                    const timestamp = parseFloat(columns[timestampIndex]);
                    const rrInterval = parseFloat(columns[rrIndex]);

                    if (!isNaN(timestamp) && !isNaN(rrInterval)) {
                      const entry: { timestamp: number; rrInterval: number; allRrIntervals?: number[] } = {
                        timestamp,
                        rrInterval
                      };

                      // Try to parse allRrIntervals if present
                      if (allRrIndex !== -1 && columns.length > allRrIndex) {
                        try {
                          const allRrStr = columns[allRrIndex].replace(/^"|"$/g, '').trim();
                          if (allRrStr.startsWith('[') && allRrStr.endsWith(']')) {
                            const parsed = JSON.parse(allRrStr);
                            if (Array.isArray(parsed)) {
                              entry.allRrIntervals = parsed;
                            }
                          }
                        } catch (e) {
                          // Ignore parsing error for array
                        }
                      }

                      rawData.push(entry);
                    }
                  }
                }
              }
            }
          }
        } else {
          console.error(`[API] Failed to fetch raw file: ${fileResponse.status}`);
        }
      } catch (error) {
        console.error('[API] Error processing raw file:', error);
      }
    }

    // Convert SessionSummaryRecord to SessionSummaryPayload
    const payload: SessionSummaryPayload = {
      session_id: summaryRecord.session_id,
      user_id: summaryRecord.user_id,
      rmssd_session_ms: summaryRecord.rmssd_session_ms,
      rmssd_cv_percent: summaryRecord.rmssd_cv_percent ?? null,
      sdnn_session_ms: summaryRecord.sdnn_session_ms,
      pnn50_percent: summaryRecord.pnn50_percent,
      session_mean_hr: summaryRecord.session_mean_hr,
      amode_50: summaryRecord.amode_50 ?? null,
      AMo50_count: summaryRecord.AMo50_count ?? null,
      rr_max_ms: summaryRecord.rr_max_ms,
      rr_min_ms: summaryRecord.rr_min_ms,
      mxdmn_ms: summaryRecord.mxdmn_ms,
      rmssd_start_ms: summaryRecord.rmssd_start_ms,
      rmssd_end_ms: summaryRecord.rmssd_end_ms,
      time_to_stabilize_seconds: summaryRecord.time_to_stabilize_seconds,
      resp_coherence_score: summaryRecord.resp_coherence_score,
      restoration_index: summaryRecord.restoration_index,
      session_stress_index: summaryRecord.session_stress_index,
      mean_rr_ms: summaryRecord.mean_rr_ms ?? null,
      lf_power_ms2: summaryRecord.lf_power_ms2 ?? null,
      hf_power_ms2: summaryRecord.hf_power_ms2 ?? null,
      lfhf_ratio: summaryRecord.lfhf_ratio ?? null,
      total_power_ms2: summaryRecord.total_power_ms2 ?? null,
      sd1_ms: summaryRecord.sd1_ms ?? null,
      sd2_ms: summaryRecord.sd2_ms ?? null,
      sd2_sd1_ratio: summaryRecord.sd2_sd1_ratio ?? null,
      baevsky_mo: summaryRecord.baevsky_mo ?? null,
      baevsky_amo: summaryRecord.baevsky_amo ?? null,
      baevsky_mxdmn_ms: summaryRecord.baevsky_mxdmn_ms ?? null,
      baevsky_stress_index: summaryRecord.baevsky_stress_index ?? null,
      sd1_sd2_balance_score_nbs: summaryRecord.sd1_sd2_balance_score_nbs ?? null,
      sd1_sd2_parasympathetic_percent: summaryRecord.sd1_sd2_parasympathetic_percent ?? null,
      sd1_sd2_sympathetic_percent: summaryRecord.sd1_sd2_sympathetic_percent ?? null,
      energy_score: summaryRecord.energy_score ?? null,
      stress_score: summaryRecord.stress_score ?? null,
      health_score: summaryRecord.health_score ?? null,
      focus_score: summaryRecord.focus_score ?? null,
      hrv_score: summaryRecord.hrv_score ?? null,
      session_date: summaryRecord.session_date ?? null,
      ai_title: summaryRecord.ai_title ?? null,
      ai_interpretation: summaryRecord.ai_interpretation ?? null,
    };

    // Build SessionSummary with ACTUAL raw data
    // If raw extraction failed (rawData empty), fall back to estimate for data points count
    const dataPointsCount = rawData.length > 0 ? rawData.length : Math.max(60, durationSeconds);
    const sessionSummary = buildSessionSummary(payload, durationSeconds, dataPointsCount, rawData, sessionId);

    // =========================================================================
    // START INTERPRETATION LOGIC (Merged from /api/sessions/[id]/interpret)
    // =========================================================================

    let interpretation: InterpretationResult | null = null;
    let baseline: UserBaseline | null = null;
    let baselineDatetime: string | null = null;
    let comparisonSessionDate: string | null = null;
    let firstSessionDate: string | null = null;
    let phaseName: 'calibration' | 'early_baseline' | 'full_baseline' = 'calibration';
    let progress = 0;
    let uniqueDays = 0;

    // Only attempt interpretation if userId is present (not Guest)
    if (userId) {
      try {
        // Fetch user profile for timezone
        let userTimezone = DEFAULT_TIMEZONE;
        let userProfile = null;
        try {
          userProfile = await pb.collection('users').getOne(userId);
          userTimezone = userProfile.timezone || DEFAULT_TIMEZONE;
        } catch (error) {
          console.error('[API] Could not fetch user profile:', error);
        }

        // Determine session date
        let sessionDate: Date;
        if (sessionSummary.rrIntervals?.[0]?.timestamp && sessionSummary.rrIntervals[0].timestamp > 1600000000000) {
          sessionDate = new Date(sessionSummary.rrIntervals[0].timestamp);
        } else if (summaryRecord.session_date) {
          sessionDate = new Date(summaryRecord.session_date);
        } else {
          sessionDate = new Date(session.startTime);
        }
        const sessionDateISO = sessionDate.toISOString();

        // Fetch comparison sessions to determine phase
        const compFilter = `user_id = "${userId}" && session_id != "${sessionId}" && session_date < "${formatDateForPocketBase(sessionDateISO)}"`;
        const previousSessionsResponse = await pb.collection('session_summary').getFullList({
          filter: compFilter,
          sort: '-session_date'
        });

        const previousSessions = previousSessionsResponse
          .map(s => withDollarId(s))
          .filter(s => !s.is_crash) as unknown as SessionSummaryRecord[];

        // Calculate phase based on unique days
        const uniqueDatesSet = new Set<string>();
        previousSessions.forEach(s => {
          const d = s.session_date || s.createdAt;
          if (d) uniqueDatesSet.add(toLocalDateString(d, userTimezone));
        });
        uniqueDatesSet.add(toLocalDateString(sessionDate, userTimezone));

        uniqueDays = uniqueDatesSet.size;
        progress = Math.min(Math.round((uniqueDays / 15) * 100), 100);

        if (uniqueDays >= 15) phaseName = 'full_baseline';
        else if (uniqueDays >= 4) phaseName = 'early_baseline';

        // Calculate firstSessionDate for calibration countdown
        if (previousSessions.length > 0) {
          const allSessions = [...previousSessions];
          allSessions.sort((a, b) => {
            const dateA = new Date(a.session_date || a.createdAt).getTime();
            const dateB = new Date(b.session_date || b.createdAt).getTime();
            return dateA - dateB;
          });
          const firstSession = allSessions[0];
          firstSessionDate = firstSession.session_date || firstSession.createdAt || null;
        } else {
          // This is the first session
          firstSessionDate = sessionDateISO;
        }

        // Generate interpretation based on phase
        if (phaseName === 'calibration') {
          // Calibration phase: Compare to previous session
          const comparisonResult = findComparisonSession(sessionDate, previousSessions);

          if (comparisonResult.session) {
            if (comparisonResult.session.session_date) {
              comparisonSessionDate = comparisonResult.session.session_date;
            } else if (comparisonResult.session.createdAt) {
              comparisonSessionDate = comparisonResult.session.createdAt;
            }

            interpretation = generateCalibrationInterpretation(
              sessionSummary,
              comparisonResult.session,
              comparisonResult.insightText,
              comparisonResult.metricTitle
            );
          } else {
            // Fallback to score-based if no valid comparison found
            interpretation = generateScoreBasedInterpretation(sessionSummary, previousSessions.length === 0);
          }
        } else {
          // Baseline phase: Compare to baseline
          // Check if session is historical (more than 5 seconds old)
          const isHistoricalSession = (Date.now() - sessionDate.getTime()) > 5000;

          if (isHistoricalSession) {
            // For historical sessions, fetch baseline that existed at least 18 hours before the session
            const cutoffDate = new Date(sessionDate.getTime() - (18 * 60 * 60 * 1000)); // 18 hours
            const pbCutoffDate = formatDateForPocketBase(cutoffDate);

            const snapshots = await pb.collection('baseline_history').getList(1, 50, {
              filter: `user_id = "${userId}" && snapshot_date <= "${pbCutoffDate}"`,
              sort: '-snapshot_date'
            });

            const validSnapshots = snapshots.items.filter(s => s.established === true);

            if (validSnapshots.length > 0) {
              const snapshot = withDollarId(validSnapshots[0]);
              baseline = {
                $id: snapshot.$id,
                user_id: snapshot.user_id,
                rmssd_avg: snapshot.rmssd_avg,
                rmssd_stdev: snapshot.rmssd_stdev,
                sdnn_avg: snapshot.sdnn_avg,
                sdnn_stdev: snapshot.sdnn_stdev,
                hr_avg: snapshot.hr_avg,
                hr_stdev: snapshot.hr_stdev,
                sd1_sd2_ratio_avg: snapshot.sd1_sd2_ratio_avg,
                sd1_sd2_ratio_stdev: snapshot.sd1_sd2_ratio_stdev,
                lf_power_avg: snapshot.lf_power_avg ?? null,
                hf_power_avg: snapshot.hf_power_avg ?? null,
                lf_hf_avg: snapshot.lf_hf_avg ?? null,
                amo50_avg: snapshot.amo50_avg ?? null,
                energy_score_avg: snapshot.energy_score_avg ?? null,
                energy_score_stdev: snapshot.energy_score_stdev ?? null,
                stress_score_avg: snapshot.stress_score_avg ?? null,
                stress_score_stdev: snapshot.stress_score_stdev ?? null,
                health_score_avg: snapshot.health_score_avg ?? null,
                health_score_stdev: snapshot.health_score_stdev ?? null,
                focus_score_avg: snapshot.focus_score_avg ?? null,
                focus_score_stdev: snapshot.focus_score_stdev ?? null,
                hrv_score_avg: snapshot.hrv_score_avg ?? null,
                hrv_score_stdev: snapshot.hrv_score_stdev ?? null,
                sessions_count: snapshot.sessions_count,
                established: snapshot.established,
                unique_morning_sessions_count: undefined,
                calibration_progress: undefined,
                last_updated: snapshot.snapshot_date,
                createdAt: snapshot.createdAt
              };
              baselineDatetime = snapshot.snapshot_date;
            }
          } else {
            // For recent sessions, use current baseline
            try {
              const baselineRecord = await pb.collection('user_baselines').getFirstListItem(
                `user_id = "${userId}"`
              );
              baseline = withDollarId(baselineRecord) as unknown as UserBaseline;
            } catch (error: any) {
              if (error.status !== 404) {
                console.error('Error fetching current baseline', error);
              }
              // Baseline doesn't exist - will fall back to score-based
            }
          }

          // Generate interpretation with baseline
          if (baseline && baseline.established) {
            interpretation = interpretHRVSession(sessionSummary, baseline);
          }

          // Fallback to score-based if no baseline or interpretation failed
          if (!interpretation) {
            interpretation = generateScoreBasedInterpretation(sessionSummary, false);
          }
        }
      } catch (error) {
        console.error('[API] Error generating interpretation:', error);
        // Fallback to safe interpretation
        interpretation = generateScoreBasedInterpretation(sessionSummary, true);
      }
    } else {
      // Guest user interpretation
      interpretation = generateScoreBasedInterpretation(sessionSummary, true);
    }

    // =========================================================================
    // END INTERPRETATION LOGIC
    // =========================================================================

    return NextResponse.json({
      session: withDollarId(session),
      summary: sessionSummary,
      summaryRecord: summaryRecord,
      // Include interpretation data
      interpretation,
      baseline: baseline || null,
      baselineDatetime: baselineDatetime || null,
      comparisonSessionDate: comparisonSessionDate || null,
      firstSessionDate: firstSessionDate || null,
      phase: {
        name: phaseName,
        progress,
        uniqueDays
      }
    });

  } catch (error: unknown) {
    console.error('Error fetching session data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

