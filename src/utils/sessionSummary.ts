import { RawHeartData, SessionSummaryPayload } from '@/types';
import {
  calculateRMSSD,
  calculateSDNN,
  calculatePNN50,
  calculateMeanHR,
  calculateMxDMn
} from '@/utils/hrv';

interface TimestampedRR {
  timestamp: number;
  value: number;
}

interface SummaryMetricOptions {
  rawData: RawHeartData[];
  sessionStartTime: string | null;
  durationSeconds: number;
  userId: string;
  sessionId: string;
}

const START_END_WINDOW_SECONDS = 120;
const STABILITY_WINDOW_SECONDS = 30;
const STABILITY_STEP_SECONDS = 5;
const STABILITY_THRESHOLD_BPM = 5;
const MAX_TIME_TO_STABILIZE_SECONDS = 900;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const flattenRrSeries = (rawData: RawHeartData[], sessionStartTimestamp: number): TimestampedRR[] => {
  const series: TimestampedRR[] = [];
  let fallbackTimestamp = sessionStartTimestamp;

  for (const entry of rawData) {
    const baseTimestamp = typeof entry.timestamp === 'number' ? entry.timestamp : fallbackTimestamp;
    fallbackTimestamp = baseTimestamp;

    if (Array.isArray(entry.allRrIntervals) && entry.allRrIntervals.length > 0) {
      entry.allRrIntervals.forEach((rr) => {
        if (typeof rr === 'number' && !Number.isNaN(rr) && rr > 0) {
          series.push({ timestamp: baseTimestamp, value: rr });
        }
      });
    } else if (typeof entry.rrInterval === 'number' && entry.rrInterval > 0) {
      series.push({ timestamp: baseTimestamp, value: entry.rrInterval });
    }
  }

  return series.sort((a, b) => a.timestamp - b.timestamp);
};

const calculateAMoMetrics = (rrSeries: number[]) => {
  if (rrSeries.length === 0) {
    return { amode50: null, AMo50Count: null };
  }

  const binWidth = 50;
  const counts = new Map<number, number>();

  rrSeries.forEach((rr) => {
    const bin = Math.floor(rr / binWidth) * binWidth;
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  });

  let maxCount = 0;

  counts.forEach((count) => {
    if (count > maxCount) {
      maxCount = count;
    }
  });

  if (maxCount === 0) {
    return { amode50: null, AMo50Count: null };
  }

  return {
    amode50: (maxCount / rrSeries.length) * 100,
    AMo50Count: maxCount,
  };
};

const windowedHeartRates = (rawData: RawHeartData[], sessionStartTimestamp: number) => {
  return rawData
    .filter((entry) => typeof entry.timestamp === 'number')
    .map((entry) => {
      const timestamp = entry.timestamp ?? sessionStartTimestamp;
      const heartRate = typeof entry.heartRate === 'number' && entry.heartRate > 0
        ? entry.heartRate
        : (Array.isArray(entry.allRrIntervals) && entry.allRrIntervals.length > 0)
          ? 60000 / entry.allRrIntervals[0]
          : entry.rrInterval
            ? 60000 / entry.rrInterval
            : null;
      return { timestamp, heartRate: heartRate && Number.isFinite(heartRate) ? heartRate : null };
    })
    .filter((entry) => entry.heartRate !== null)
    .sort((a, b) => a.timestamp - b.timestamp);
};

const computeTimeToStabilize = (rawData: RawHeartData[], sessionStartTimestamp: number, sessionMeanHr: number | null): number | null => {
  if (!sessionMeanHr) {
    return null;
  }

  const series = windowedHeartRates(rawData, sessionStartTimestamp);
  if (series.length === 0) {
    return null;
  }

  const windowMs = STABILITY_WINDOW_SECONDS * 1000;
  const stepMs = STABILITY_STEP_SECONDS * 1000;
  const endTimestamp = series[series.length - 1].timestamp;

  const windowAverages: { start: number; avg: number }[] = [];

  for (let start = sessionStartTimestamp; start <= endTimestamp - windowMs; start += stepMs) {
    const windowEnd = start + windowMs;
    const points = series.filter((point) => point.timestamp >= start && point.timestamp <= windowEnd);
    if (points.length === 0) continue;
    const avg = points.reduce((sum, point) => sum + (point.heartRate ?? 0), 0) / points.length;
    windowAverages.push({ start, avg });
  }

  if (windowAverages.length === 0) {
    return null;
  }

  for (const candidate of windowAverages) {
    const isStable = windowAverages
      .filter((window) => window.start >= candidate.start)
      .every((window) => Math.abs(window.avg - sessionMeanHr) <= STABILITY_THRESHOLD_BPM);

    if (isStable) {
      return clamp(Math.round((candidate.start - sessionStartTimestamp) / 1000), 0, MAX_TIME_TO_STABILIZE_SECONDS);
    }
  }

  return MAX_TIME_TO_STABILIZE_SECONDS;
};

const computeRespCoherenceScore = (rmssd: number | null, sdnn: number | null, pnn50: number | null): number | null => {
  if (rmssd === null && sdnn === null && pnn50 === null) {
    return null;
  }

  const rmssdScore = rmssd === null ? 0 : clamp((rmssd / 180) * 100, 0, 100);
  const sdnnScore = sdnn === null ? 0 : clamp((sdnn / 200) * 100, 0, 100);
  const pnn50Score = pnn50 === null ? 0 : clamp(pnn50, 0, 100);

  return Number((0.4 * rmssdScore + 0.3 * sdnnScore + 0.3 * pnn50Score).toFixed(2));
};

const computeRestorationIndex = (
  rmssd: number | null,
  coherence: number | null,
  timeToStabilize: number | null
): number | null => {
  if (rmssd === null && coherence === null && timeToStabilize === null) {
    return null;
  }

  const rmssdComponent = rmssd === null ? 0 : clamp((rmssd / 150) * 100, 0, 100);
  const coherenceComponent = coherence ?? 0;
  const timeComponent = timeToStabilize === null ? 50 : clamp(100 - (timeToStabilize / MAX_TIME_TO_STABILIZE_SECONDS) * 100, 0, 100);

  return Number((0.45 * rmssdComponent + 0.35 * coherenceComponent + 0.2 * timeComponent).toFixed(2));
};

const computeHrvStability = (rrSeries: TimestampedRR[], sessionStartTimestamp: number): number | null => {
  if (rrSeries.length < 2) {
    return null;
  }

  const oneMinuteMs = 60 * 1000;
  const endTimestamp = rrSeries[rrSeries.length - 1].timestamp;
  const sessionEndTimestamp = sessionStartTimestamp + (endTimestamp - sessionStartTimestamp);

  // Calculate 1-minute RMSSD windows
  const rmssdWindows: number[] = [];
  
  for (let windowStart = sessionStartTimestamp; windowStart < sessionEndTimestamp - oneMinuteMs; windowStart += oneMinuteMs) {
    const windowEnd = windowStart + oneMinuteMs;
    const windowData = rrSeries
      .filter(sample => sample.timestamp >= windowStart && sample.timestamp <= windowEnd)
      .map(sample => sample.value);
    
    if (windowData.length >= 2) {
      const windowRmssd = calculateRMSSD(windowData);
      if (windowRmssd !== null) {
        rmssdWindows.push(windowRmssd);
      }
    }
  }

  if (rmssdWindows.length < 2) {
    return null;
  }

  // Calculate coefficient of variation (CV = std / mean * 100)
  const mean = rmssdWindows.reduce((sum, value) => sum + value, 0) / rmssdWindows.length;
  if (mean === 0) return null;

  const variance = rmssdWindows.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / rmssdWindows.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = (standardDeviation / mean) * 100;

  return Number(coefficientOfVariation.toFixed(2));
};

export const computeSessionSummaryPayload = ({
  rawData,
  sessionStartTime,
  durationSeconds,
  userId,
  sessionId,
}: SummaryMetricOptions): SessionSummaryPayload => {
  const sessionStartTimestamp = sessionStartTime ? Date.parse(sessionStartTime) : (rawData[0]?.timestamp ?? Date.now());
  const rrSeries = flattenRrSeries(rawData, sessionStartTimestamp);
  const rrValues = rrSeries.map((item) => item.value);

  const rmssdSession = calculateRMSSD(rrValues);
  const sdnnSession = calculateSDNN(rrValues);
  const pnn50 = calculatePNN50(rrValues);
  const meanHr = calculateMeanHR(rrValues);
  const { amode50, AMo50Count } = calculateAMoMetrics(rrValues);
  const mxDmN = calculateMxDMn(rrValues);
  const rrMax = rrValues.length ? Math.max(...rrValues) : null;
  const rrMin = rrValues.length ? Math.min(...rrValues) : null;

  const windowMs = START_END_WINDOW_SECONDS * 1000;
  const endTimestamp = rrSeries.length ? rrSeries[rrSeries.length - 1].timestamp : sessionStartTimestamp + durationSeconds * 1000;
  const startWindow = rrSeries.filter((sample) => sample.timestamp <= sessionStartTimestamp + windowMs).map((sample) => sample.value);
  const endWindow = rrSeries.filter((sample) => sample.timestamp >= endTimestamp - windowMs).map((sample) => sample.value);

  const rmssdStart = startWindow.length >= 2 ? calculateRMSSD(startWindow) : null;
  const rmssdEnd = endWindow.length >= 2 ? calculateRMSSD(endWindow) : null;

  const timeToStabilize = computeTimeToStabilize(rawData, sessionStartTimestamp, meanHr);
  const respCoherence = computeRespCoherenceScore(rmssdSession, sdnnSession, pnn50);
  const hrvStability = computeHrvStability(rrSeries, sessionStartTimestamp);

  let sessionStressIndex: number | null = null;
  if (amode50 !== null && mxDmN && mxDmN !== 0) {
    sessionStressIndex = Number(((amode50 / mxDmN) * 100).toFixed(2));
  }

  const restorationIndex = computeRestorationIndex(rmssdSession, respCoherence, timeToStabilize);

  // Calculate RMSSD Delta (End - Start)
  const rmssdDelta = (rmssdEnd !== null && rmssdStart !== null) ? rmssdEnd - rmssdStart : null;

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
  };
};
