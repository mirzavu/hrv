import { SessionSummary, SessionSummaryPayload } from '@/types';
import { formatDuration, formatRmssdDelta, formatPercentage, formatScore } from './sessionSummaryFormat';

/**
 * Build a SessionSummary object for display from computed session metrics
 */
export const buildSessionSummary = (
  payload: SessionSummaryPayload,
  durationSeconds: number,
  dataPointsCount: number,
  rawData: Array<{timestamp: number; rrInterval?: number; allRrIntervals?: number[]}> = []
): SessionSummary => {
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
      label: 'Session Stress Index',
      value: payload.session_stress_index,
      unit: ''
    },

    // Data quality
    dataPoints: {
      label: 'Data Points',
      value: dataPointsCount,
      unit: ''
    },

    // Raw data for visualization
    rrIntervals: rrIntervals
  };
};