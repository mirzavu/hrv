import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';
import { buildSessionSummary } from '@/utils/buildSessionSummary';
import { SessionSummaryPayload } from '@/types';
import { interpretHRVSession } from '@/utils/autonomicInterpretation';
import { 
  generateScoreBasedInterpretation, 
  generateCalibrationInterpretation,
  findComparisonSession 
} from '@/utils/sessionComparison';
import { formatDateForPocketBase } from '@/utils/dateUtils';
import { toLocalDateString, DEFAULT_TIMEZONE } from '@/utils/dateUtils';
import type { InterpretationResult } from '@/utils/autonomicInterpretation';
import type { SessionSummary, UserBaseline, SessionSummaryRecord, PhaseData } from '@/types';

/**
 * GET /api/sessions/[sessionId]/interpret?userId={userId}
 * 
 * Generates interpretation for a session based on user phase and baseline status.
 * Handles calibration phase (comparison to previous sessions) and baseline phase (comparison to baseline).
 * Returns InterpretationResult matching the frontend type structure.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  try {
    // Handle both sync and async params (Next.js 14 vs 15)
    const resolvedParams = params instanceof Promise ? await params : params;
    const sessionId = resolvedParams.sessionId;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Fetch session record
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

    // Calculate duration
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

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
      is_crash: summaryRecord.is_crash ?? false,
    };

    // Build SessionSummary (minimal - we only need it for interpretation functions)
    // We don't need full raw data for interpretation, so use empty array
    const dataPointsCount = Math.max(60, durationSeconds);
    const sessionSummary = buildSessionSummary(payload, durationSeconds, dataPointsCount, [], sessionId);

    // Handle guest users (no userId)
    if (!userId) {
      const result = generateScoreBasedInterpretation(sessionSummary, true);
      return NextResponse.json({
        interpretation: result,
        baseline: null,
        phase: null
      });
    }

    // Fetch user profile for timezone
    let userTimezone = DEFAULT_TIMEZONE;
    let userProfile = null;
    try {
      userProfile = await pb.collection('users').getOne(userId);
      userTimezone = userProfile.timezone || DEFAULT_TIMEZONE;
    } catch (error) {
      console.error('[Interpret API] Could not fetch user profile:', error);
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
      .filter(s => !s.is_crash) as SessionSummaryRecord[];

    // Calculate phase based on unique days
    const uniqueDatesSet = new Set<string>();
    previousSessions.forEach(s => {
      const d = s.session_date || s.createdAt;
      if (d) uniqueDatesSet.add(toLocalDateString(d, userTimezone));
    });
    uniqueDatesSet.add(toLocalDateString(sessionDate, userTimezone));

    const uniqueDays = uniqueDatesSet.size;
    const progress = Math.min(Math.round((uniqueDays / 15) * 100), 100);

    let phaseName: 'calibration' | 'early_baseline' | 'full_baseline' = 'calibration';
    if (uniqueDays >= 15) phaseName = 'full_baseline';
    else if (uniqueDays >= 4) phaseName = 'early_baseline';

    // Generate interpretation based on phase
    let interpretation: InterpretationResult | null = null;
    let baseline: UserBaseline | null = null;
    let baselineDatetime: string | null = null;

    if (phaseName === 'calibration') {
      // Calibration phase: Compare to previous session
      const comparisonResult = findComparisonSession(sessionDate, previousSessions);

      if (comparisonResult.session) {
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
          baseline = withDollarId(baselineRecord) as UserBaseline;
        } catch (error: any) {
          if (error.status !== 404) {
            throw error;
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

    // Return interpretation result
    return NextResponse.json({
      interpretation,
      baseline: baseline || null,
      baselineDatetime: baselineDatetime || null,
      phase: {
        name: phaseName,
        progress,
        uniqueDays
      }
    });

  } catch (error: unknown) {
    console.error('[Interpret API] Error generating interpretation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate interpretation', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

