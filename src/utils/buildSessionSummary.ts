import { SessionSummary, SessionSummaryPayload, PhaseData } from '@/types';

/**
 * Build a SessionSummary object for display from computed session metrics
 */
export const buildSessionSummary = (
  payload: SessionSummaryPayload & { phase?: PhaseData | null },
  durationSeconds: number,
  dataPointsCount: number,
  rawData: Array<{ timestamp: number; rrInterval?: number; allRrIntervals?: number[] }> = [],
  sessionId?: string | null
): SessionSummary => {
  console.log('🔍 [BUILD_SUMMARY_DEBUG] Building session summary');
  console.log('🔍 [BUILD_SUMMARY_DEBUG] payload.rmssd_cv_percent:', payload.rmssd_cv_percent);
  console.log('🔍 [BUILD_SUMMARY_DEBUG] Full payload:', payload);

  // Compute RMSSD Delta dynamically
  const rmssdDelta = (payload.rmssd_end_ms !== null && payload.rmssd_start_ms !== null)
    ? payload.rmssd_end_ms - payload.rmssd_start_ms
    : null;

  // Extract RR intervals for visualization
  const rrIntervals: Array<{ timestamp: number; value: number }> = [];
  rawData.forEach(entry => {
    if (Array.isArray(entry.allRrIntervals) && entry.allRrIntervals.length > 0) {
      entry.allRrIntervals.forEach(rr => {
        if (typeof rr === 'number' && rr > 0) {
          rrIntervals.push({ timestamp: entry.timestamp, value: rr });
        }
      });
    } else if (typeof entry.rrInterval === 'number' && entry.rrInterval > 0) {
      rrIntervals.push({ timestamp: entry.timestamp, value: entry.rrInterval });
    }
  });

  // Use server-calculated 4 scores from database
  return {
    // Core session metrics
    duration: {
      label: 'Duration',
      value: durationSeconds,
      unit: 'sec'
    },
    meanHR: {
      label: 'Mean Heart Rate',
      value: payload.session_mean_hr,
      unit: 'bpm'
    },

    // HRV metrics
    sessionRMSSD: {
      label: 'Session RMSSD',
      value: payload.rmssd_session_ms,
      unit: 'ms'
    },
    startRMSSD: {
      label: 'Start RMSSD (2min)',
      value: payload.rmssd_start_ms,
      unit: 'ms'
    },
    endRMSSD: {
      label: 'End RMSSD (2min)',
      value: payload.rmssd_end_ms,
      unit: 'ms'
    },
    rmssdDelta: {
      label: 'RMSSD Change',
      value: rmssdDelta,
      unit: 'ms'
    },
    hrvStability: {
      label: 'HRV Stability',
      value: payload.rmssd_cv_percent ?? null,
      unit: '% CV'
    },

    // Performance metrics
    timeToStabilize: {
      label: 'Time to Stabilize',
      value: payload.time_to_stabilize_seconds,
      unit: 's'
    },
    respCoherence: {
      label: 'Respiratory Coherence',
      value: payload.resp_coherence_score,
      unit: '/100'
    },
    restorationIndex: {
      label: 'Restoration Index',
      value: payload.restoration_index,
      unit: '/100'
    },
    sessionStressIndex: {
      label: 'Stress Index',
      value: payload.session_stress_index,
      unit: ''
    },

    // New 4-score metrics (from server calculation)
    energyScore: {
      label: 'Energy Score',
      value: payload.energy_score,
      unit: '/100'
    },
    stressScore: {
      label: 'Stress Score',
      value: payload.stress_score,
      unit: '/100'
    },
    healthScore: {
      label: 'Health Score',
      value: payload.health_score,
      unit: '/100'
    },
    focusScore: {
      label: 'Focus Score',
      value: payload.focus_score,
      unit: '/100'
    },

    // HRV Score (0-100)
    hrvScore: {
      label: 'HRV Score',
      value: payload.hrv_score,
      unit: '/100'
    },

    // Frequency domain metrics
    lfPower: {
      label: 'LF Power',
      value: payload.lf_power_ms2,
      unit: 'ms²'
    },
    hfPower: {
      label: 'HF Power',
      value: payload.hf_power_ms2,
      unit: 'ms²'
    },
    totalPower: payload.total_power_ms2,
    sd2_sd1_ratio: payload.sd2_sd1_ratio,
    lfhfRatio: payload.lfhf_ratio ?? null,

    // Additional HRV metrics
    sdnn: {
      label: 'SDNN',
      value: payload.sdnn_session_ms,
      unit: 'ms'
    },
    amode50: payload.amode_50 ?? null,

    // === NEW SD2/SD1-based Balance Percentages ===
    sd1_sd2_balance_score_nbs: payload.sd1_sd2_balance_score_nbs,
    sd1_sd2_parasympathetic_percent: payload.sd1_sd2_parasympathetic_percent,
    sd1_sd2_sympathetic_percent: payload.sd1_sd2_sympathetic_percent,
    // === END NEW ===

    // Data quality
    dataPoints: {
      label: 'Beats',
      value: dataPointsCount,
      unit: ''
    },

    // Crash & Phase from Server
    is_crash: payload.is_crash,
    // usage_phase is now stored in users table, not in session_summary

    // AI Insight from database
    ai_title: payload.ai_title ?? null,
    ai_interpretation: payload.ai_interpretation ?? null,

    // Session ID for database operations
    session_id: sessionId || payload.session_id || null,

    // Phase data from analyze API (for progress bar)
    phaseData: payload.phase || null,

    // Raw data for visualization
    rrIntervals: rrIntervals
  };
};