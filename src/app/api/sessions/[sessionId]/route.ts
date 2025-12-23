import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';
import { buildSessionSummary } from '@/utils/buildSessionSummary';
import { SessionSummaryPayload } from '@/types';

// GET /api/sessions/[sessionId] - Fetch full session data with summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  try {
    // Handle both sync and async params (Next.js 14 vs 15)
    const resolvedParams = params instanceof Promise ? await params : params;
    const sessionId = resolvedParams.sessionId;

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
    };

    // Build SessionSummary (without RR intervals for now - can be added later if needed)
    // Estimate data points count from duration (rough estimate: ~1 beat per second)
    const estimatedDataPoints = Math.max(60, durationSeconds);
    const sessionSummary = buildSessionSummary(payload, durationSeconds, estimatedDataPoints, []);

    return NextResponse.json({
      session: withDollarId(session),
      summary: sessionSummary,
      summaryRecord: summaryRecord
    });

  } catch (error: unknown) {
    console.error('Error fetching session data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

