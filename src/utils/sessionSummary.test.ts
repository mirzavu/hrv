import { describe, it, expect } from 'vitest';
import { computeSessionSummaryPayload } from '@/utils/sessionSummary';
import { RawHeartData } from '@/types';

const baseTimestamp = Date.now();

const buildSampleData = (): RawHeartData[] => {
  const rrSeries = [900, 880, 920, 910, 905];
  return rrSeries.map((rr, index) => ({
    timestamp: baseTimestamp + index * 1000,
    heartRate: Math.round(60000 / rr),
    rrInterval: rr,
    allRrIntervals: [rr],
  }));
};

describe('computeSessionSummaryPayload', () => {
  it('produces expected HRV metrics for a simple dataset', () => {
    const rawData = buildSampleData();

    const payload = computeSessionSummaryPayload({
      rawData,
      sessionStartTime: new Date(baseTimestamp).toISOString(),
      durationSeconds: rawData.length,
      userId: 'user_123',
      sessionId: 'session_456',
    });

    expect(payload.session_id).toBe('session_456');
    expect(payload.user_id).toBe('user_123');

    expect(payload.rmssd_session_ms).toBeCloseTo(23.05, 2);
    expect(payload.sdnn_session_ms).toBeCloseTo(13.27, 2);
    expect(payload.pnn50_percent).toBe(0);
  expect(payload.session_mean_hr).toBeCloseTo(66.45, 2);
    expect(payload.amode_50).toBeCloseTo(80, 2);
    expect(payload.AMo50_count).toBe(4);
    expect(payload.rr_max_ms).toBe(920);
    expect(payload.rr_min_ms).toBe(880);
    expect(payload.mxdmn_ms).toBe(40);
    expect(payload.rmssd_start_ms).toBeCloseTo(23.05, 2);
    expect(payload.rmssd_end_ms).toBeCloseTo(23.05, 2);
    expect(payload.time_to_stabilize_seconds).toBeNull();
  expect(payload.resp_coherence_score).toBeCloseTo(7.11, 2);
  expect(payload.restoration_index).toBeCloseTo(19.4, 2);
    expect(payload.session_stress_index).toBeCloseTo(200, 2);
  });

  it('handles empty datasets gracefully', () => {
    const payload = computeSessionSummaryPayload({
      rawData: [],
      sessionStartTime: null,
      durationSeconds: 0,
      userId: 'user_123',
      sessionId: 'session_empty',
    });

    expect(payload.session_id).toBe('session_empty');
    expect(payload.user_id).toBe('user_123');
    Object.keys(payload).forEach((key) => {
      if (key === 'session_id' || key === 'user_id') {
        return;
      }
      expect((payload as Record<string, unknown>)[key]).toBeNull();
    });
  });
});
