// Session processing and data transformation utilities

import type { RawHeartData } from '@/types';
import { calculateHrvScore } from './scoreCalculations';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const START_END_WINDOW_SECONDS = 120;
export const STABILITY_WINDOW_SECONDS = 30;
export const STABILITY_STEP_SECONDS = 5;
export const STABILITY_THRESHOLD_BPM = 5;
export const MAX_TIME_TO_STABILIZE_SECONDS = 900;

export interface TimestampedRR {
    timestamp: number;
    value: number;
}

export const windowedHeartRates = (rawData: RawHeartData[], sessionStartTimestamp: number) => {
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

export const computeTimeToStabilize = (rawData: RawHeartData[], sessionStartTimestamp: number, sessionMeanHr: number | null): number | null => {
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

export const computeRespCoherenceScore = (rmssd: number | null, sdnn: number | null, pnn50: number | null): number | null => {
    if (rmssd === null && sdnn === null && pnn50 === null) {
        return null;
    }

    const rmssdScore = rmssd === null ? 0 : clamp((rmssd / 180) * 100, 0, 100);
    const sdnnScore = sdnn === null ? 0 : clamp((sdnn / 200) * 100, 0, 100);
    const pnn50Score = pnn50 === null ? 0 : clamp(pnn50, 0, 100);

    return Number((0.4 * rmssdScore + 0.3 * sdnnScore + 0.3 * pnn50Score).toFixed(2));
};

export const computeRestorationIndex = (
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

export const computeHrvStability = (
    rrSeries: TimestampedRR[], 
    sessionStartTimestamp: number, 
    calculateRMSSD: (rr: number[]) => number | null,
    calculateSDNN: (rr: number[]) => number | null,
    calculateMeanHR: (rr: number[]) => number | null
): number | null => {
    console.log('🔍 [HRV_STABILITY_DEBUG] Starting HRV Stability calculation');
    console.log('🔍 [HRV_STABILITY_DEBUG] rrSeries.length:', rrSeries.length);
    console.log('🔍 [HRV_STABILITY_DEBUG] sessionStartTimestamp:', sessionStartTimestamp);
    
    if (rrSeries.length < 2) {
        console.warn('⚠️ [HRV_STABILITY_DEBUG] Not enough RR intervals (need at least 2)');
        return null;
    }

    const windowSizeMs = 30 * 1000; // Use 30-second windows for shorter sessions
    const endTimestamp = rrSeries[rrSeries.length - 1].timestamp;
    const sessionEndTimestamp = sessionStartTimestamp + (endTimestamp - sessionStartTimestamp);
    
    console.log('🔍 [HRV_STABILITY_DEBUG] Window size (ms):', windowSizeMs);
    console.log('🔍 [HRV_STABILITY_DEBUG] End timestamp:', endTimestamp);
    console.log('🔍 [HRV_STABILITY_DEBUG] Session duration (ms):', sessionEndTimestamp - sessionStartTimestamp);

    // Calculate HRV scores for each window
    const hrvScoreWindows: number[] = [];
    let windowIndex = 0;
    
    for (let windowStart = sessionStartTimestamp; windowStart < sessionEndTimestamp - windowSizeMs; windowStart += windowSizeMs) {
        const windowEnd = windowStart + windowSizeMs;
        const windowData = rrSeries
            .filter(sample => sample.timestamp >= windowStart && sample.timestamp <= windowEnd)
            .map(sample => sample.value);
        
        console.log(`🔍 [HRV_STABILITY_DEBUG] Window ${windowIndex}: dataPoints=${windowData.length}`);
        
        if (windowData.length >= 2) {
            const windowRmssd = calculateRMSSD(windowData);
            const windowSdnn = calculateSDNN(windowData);
            const windowMeanHr = calculateMeanHR(windowData);
            
            console.log(`🔍 [HRV_STABILITY_DEBUG] Window ${windowIndex} metrics:`, {
                rmssd: windowRmssd,
                sdnn: windowSdnn,
                meanHr: windowMeanHr
            });
            
            // Calculate HRV score for this window using the existing function
            const hrvScore = calculateHrvScore({
                rmssd: windowRmssd,
                sdnn: windowSdnn,
                meanHR: windowMeanHr,
                rmssdStart: null,
                rmssdEnd: null,
                coherence: null,
                restoration: null
            });
            
            console.log(`🔍 [HRV_STABILITY_DEBUG] Window ${windowIndex} HRV score:`, hrvScore);
            
            if (hrvScore !== null) {
                hrvScoreWindows.push(hrvScore);
            }
        }
        windowIndex++;
    }

    console.log('🔍 [HRV_STABILITY_DEBUG] Total windows with valid HRV scores:', hrvScoreWindows.length);
    console.log('🔍 [HRV_STABILITY_DEBUG] HRV score windows:', hrvScoreWindows);

    if (hrvScoreWindows.length < 2) {
        console.warn('⚠️ [HRV_STABILITY_DEBUG] Not enough windows with valid HRV scores (need at least 2)');
        return null;
    }

    // Calculate coefficient of variation (CV = std / mean * 100)
    const mean = hrvScoreWindows.reduce((sum, value) => sum + value, 0) / hrvScoreWindows.length;
    console.log('🔍 [HRV_STABILITY_DEBUG] Mean HRV score:', mean);
    
    if (mean === 0) {
        console.warn('⚠️ [HRV_STABILITY_DEBUG] Mean is zero, cannot calculate CV');
        return null;
    }

    const variance = hrvScoreWindows.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / hrvScoreWindows.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = (standardDeviation / mean) * 100;

    console.log('🔍 [HRV_STABILITY_DEBUG] Calculation results:', {
        variance,
        standardDeviation,
        coefficientOfVariation: Number(coefficientOfVariation.toFixed(2))
    });

    return Number(coefficientOfVariation.toFixed(2));
};

export const flattenRrSeries = (rawData: RawHeartData[], sessionStartTimestamp: number): TimestampedRR[] => {
    const series: TimestampedRR[] = [];
    let cumulativeTime = sessionStartTimestamp;

    console.log('🔍 [FLATTEN_DEBUG] Starting flattenRrSeries');
    console.log('🔍 [FLATTEN_DEBUG] sessionStartTimestamp:', sessionStartTimestamp);
    console.log('🔍 [FLATTEN_DEBUG] rawData.length:', rawData.length);

    for (const entry of rawData) {
        if (Array.isArray(entry.allRrIntervals) && entry.allRrIntervals.length > 0) {
            // Properly distribute timestamps for each RR interval
            // Each RR interval represents the time since the PREVIOUS heartbeat
            entry.allRrIntervals.forEach((rr) => {
                if (typeof rr === 'number' && !Number.isNaN(rr) && rr > 0) {
                    series.push({ timestamp: cumulativeTime, value: rr });
                    // Advance the cumulative timestamp by the RR interval duration
                    cumulativeTime += rr;
                }
            });
        } else if (typeof entry.rrInterval === 'number' && entry.rrInterval > 0) {
            series.push({ timestamp: cumulativeTime, value: entry.rrInterval });
            cumulativeTime += entry.rrInterval;
        }
    }

    console.log('🔍 [FLATTEN_DEBUG] Total RR intervals:', series.length);
    console.log('🔍 [FLATTEN_DEBUG] First timestamp:', series[0]?.timestamp);
    console.log('🔍 [FLATTEN_DEBUG] Last timestamp:', series[series.length - 1]?.timestamp);
    console.log('🔍 [FLATTEN_DEBUG] Duration (ms):', series.length > 0 ? series[series.length - 1].timestamp - series[0].timestamp : 0);

    return series.sort((a, b) => a.timestamp - b.timestamp);
};

