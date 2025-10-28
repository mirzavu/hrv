import { NextRequest, NextResponse } from 'next/server';

// Import types
interface RawHeartData {
  timestamp: number;
  heartRate?: number;
  rrInterval?: number;
  rawValue?: number;
  flags?: number;
  rawBytes?: number[];
  allRrIntervals?: number[];
}

interface SessionSummaryPayload {
  session_id: string;
  user_id: string;
  rmssd_session_ms: number | null;
  rmssd_cv_percent?: number | null;
  sdnn_session_ms: number | null;
  pnn50_percent: number | null;
  session_mean_hr: number | null;
  amode_50: number | null;
  AMo50_count: number | null;
  rr_max_ms: number | null;
  rr_min_ms: number | null;
  mxdmn_ms: number | null;
  rmssd_start_ms: number | null;
  rmssd_end_ms: number | null;
  time_to_stabilize_seconds: number | null;
  resp_coherence_score: number | null;
  restoration_index: number | null;
  session_stress_index: number | null;
  mean_rr_ms?: number | null;
  lf_power_ms2?: number | null;
  hf_power_ms2?: number | null;
  lfhf_ratio?: number | null;
  total_power_ms2?: number | null;
  sd1_ms?: number | null;
  sd2_ms?: number | null;
  sd2_sd1_ratio?: number | null;
  baevsky_mo?: number | null;
  baevsky_amo?: number | null;
  baevsky_mxdmn_ms?: number | null;
  baevsky_stress_index?: number | null;
  
  // === NEW SD2/SD1-based Balance Percentages ===
  sd1_sd2_balance_score_nbs?: number | null; // Normalized Balance Score (0-100)
  sd1_sd2_parasympathetic_percent?: number | null;
  sd1_sd2_sympathetic_percent?: number | null;
  // === END NEW ===
  
  // New 4-Score metrics
  energy_score?: number | null;
  stress_score?: number | null;
  health_score?: number | null;
  focus_score?: number | null;
  
  // Overall HRV Score
  hrv_score?: number | null;
}

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

// Copy HRV calculation functions (same as client-side)
const calculateRMSSD = (rr: number[]): number | null => 
    (rr.length < 2) ? null : Math.sqrt(rr.slice(1).reduce((acc, val, i) => acc + Math.pow(val - rr[i], 2), 0) / (rr.length - 1));

const calculateSDNN = (rr: number[]): number | null => {
    if (rr.length < 2) return null;
    const mean = rr.reduce((a, b) => a + b, 0) / rr.length;
    return Math.sqrt(rr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / rr.length);
};

const calculatePNN50 = (rr: number[]): number | null => 
    (rr.length < 2) ? null : (rr.slice(1).filter((val, i) => Math.abs(val - rr[i]) > 50).length / (rr.length - 1)) * 100;

const calculateMeanHR = (rr: number[]): number | null => 
    (rr.length === 0) ? null : 60000 / (rr.reduce((a, b) => a + b, 0) / rr.length);

const calculateMxDMn = (rr: number[]): number | null => 
    (rr.length < 2) ? null : Math.max(...rr) - Math.min(...rr);

// Frequency Domain HRV Calculations
const calculateFrequencyDomain = (rrIntervals: number[]): {
    lfPower: number | null;
    hfPower: number | null;
    lfhfRatio: number | null;
    totalPower: number | null;
} => {
    if (rrIntervals.length < 16) {
        return {
            lfPower: null,
            hfPower: null,
            lfhfRatio: null,
            totalPower: null
        };
    }

    try {
        const heartRates = rrIntervals.map(rr => 60000 / rr);
        const samplingRate = 4;
        
        const timeSeries: number[] = [];
        
        for (let i = 0; i < heartRates.length; i++) {
            timeSeries.push(heartRates[i]);
        }

        const windowSize = Math.min(256, Math.floor(timeSeries.length / 4));
        const overlap = Math.floor(windowSize / 2);
        const numWindows = Math.floor((timeSeries.length - overlap) / (windowSize - overlap));
        
        if (numWindows < 2) {
            return {
                lfPower: null,
                hfPower: null,
                lfhfRatio: null,
                totalPower: null
            };
        }

        const frequencies: number[] = [];
        const powerSpectrum: number[] = [];
        
        for (let i = 0; i <= windowSize / 2; i++) {
            frequencies.push((i * samplingRate) / windowSize);
            powerSpectrum.push(0);
        }

        for (let w = 0; w < numWindows; w++) {
            const start = w * (windowSize - overlap);
            const window = timeSeries.slice(start, start + windowSize);
            
            const windowed = window.map((value, i) => 
                value * 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)))
            );
            
            for (let i = 0; i <= windowSize / 2; i++) {
                let real = 0;
                let imag = 0;
                
                for (let j = 0; j < windowSize; j++) {
                    const angle = -2 * Math.PI * i * j / windowSize;
                    real += windowed[j] * Math.cos(angle);
                    imag += windowed[j] * Math.sin(angle);
                }
                
                const power = (real * real + imag * imag) / windowSize;
                powerSpectrum[i] += power;
            }
        }

        for (let i = 0; i < powerSpectrum.length; i++) {
            powerSpectrum[i] /= numWindows;
        }

        const lfStart = 0.04;
        const lfEnd = 0.15;
        const hfStart = 0.15;
        const hfEnd = 0.4;
        const vlfStart = 0.0033;
        const vlfEnd = 0.04;

        let lfPower = 0;
        let hfPower = 0;
        let vlfPower = 0;

        for (let i = 0; i < frequencies.length; i++) {
            const freq = frequencies[i];
            const power = powerSpectrum[i];
            
            if (freq >= vlfStart && freq < vlfEnd) {
                vlfPower += power;
            } else if (freq >= lfStart && freq < lfEnd) {
                lfPower += power;
            } else if (freq >= hfStart && freq <= hfEnd) {
                hfPower += power;
            }
        }

        const powerScale = 1000 * 1000;
        lfPower *= powerScale;
        hfPower *= powerScale;
        vlfPower *= powerScale;
        const totalPower = lfPower + hfPower + vlfPower;

        let lfhfRatio: number | null = null;
        if (hfPower > 0) {
            const ratio = lfPower / hfPower;
            lfhfRatio = Math.log(ratio);
        }

        return {
            lfPower: lfPower > 0 ? Number(lfPower.toFixed(2)) : null,
            hfPower: hfPower > 0 ? Number(hfPower.toFixed(2)) : null,
            lfhfRatio: lfhfRatio !== null ? Number(lfhfRatio.toFixed(3)) : null,
            totalPower: totalPower > 0 ? Number(totalPower.toFixed(2)) : null
        };

    } catch (error) {
        console.error('Error calculating frequency domain metrics:', error);
        return {
            lfPower: null,
            hfPower: null,
            lfhfRatio: null,
            totalPower: null
        };
    }
};

// Poincaré Plot Calculations
const calculatePoincareMetrics = (rrIntervals: number[]): {
    sd1: number | null;
    sd2: number | null;
} => {
    if (rrIntervals.length < 3) {
        return { sd1: null, sd2: null };
    }

    try {
        const rrn = rrIntervals.slice(0, -1);
        const rrn1 = rrIntervals.slice(1);

        const differences = rrn1.map((rr1, i) => rr1 - rrn[i]);
        const sums = rrn1.map((rr1, i) => rr1 + rrn[i]);

        const sd1Variance = differences.reduce((acc, diff) => acc + diff * diff, 0) / (differences.length - 1);
        const sd1 = Math.sqrt(sd1Variance / 2);

        const meanSum = sums.reduce((acc, sum) => acc + sum, 0) / sums.length;
        const sd2Variance = sums.reduce((acc, sum) => acc + Math.pow(sum - meanSum, 2), 0) / (sums.length - 1);
        const sd2 = Math.sqrt(sd2Variance / 2);

        return {
            sd1: Number(sd1.toFixed(2)),
            sd2: Number(sd2.toFixed(2))
        };

    } catch (error) {
        console.error('Error calculating Poincaré metrics:', error);
        return { sd1: null, sd2: null };
    }
};

// Baevsky Stress Index Calculations
const calculateBaevskyMetrics = (rrIntervals: number[]): {
    mo: number | null;
    amo: number | null;
    mxdmn: number | null;
    bsi: number | null;
} => {
    if (rrIntervals.length < 10) {
        return { mo: null, amo: null, mxdmn: null, bsi: null };
    }

    try {
        const binWidth = 50;
        const roundedRR = rrIntervals.map(rr => Math.round(rr / binWidth) * binWidth);
        
        const histogram = new Map<number, number>();
        roundedRR.forEach(rr => {
            histogram.set(rr, (histogram.get(rr) || 0) + 1);
        });

        let maxCount = 0;
        let mode = null;
        histogram.forEach((count, rr) => {
            if (count > maxCount) {
                maxCount = count;
                mode = rr;
            }
        });

        if (!mode || maxCount === 0) {
            return { mo: null, amo: null, mxdmn: null, bsi: null };
        }

        const amo = (maxCount / rrIntervals.length) * 100;

        const rrMin = Math.min(...rrIntervals);
        const rrMax = Math.max(...rrIntervals);
        const mxdmn = rrMax - rrMin;

        let bsi: number | null = null;
        if (mode > 0 && mxdmn > 0) {
            bsi = amo / (2 * mode * mxdmn);
        }

        return {
            mo: mode,
            amo: Number(amo.toFixed(2)),
            mxdmn: Number(mxdmn.toFixed(2)),
            bsi: bsi !== null ? Number(bsi.toFixed(6)) : null
        };

    } catch (error) {
        console.error('Error calculating Baevsky metrics:', error);
        return { mo: null, amo: null, mxdmn: null, bsi: null };
    }
};

// --- 4-Score Calculation Functions ---

/**
 * Normalize a value to [0,1] range using min-max normalization
 */
const normalizeMinMax = (value: number, min: number, max: number): number => {
    if (max === min) return 0.5; // Avoid division by zero
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

/**
 * Normalize LF/HF ratio using log scale
 */
const normalizeLFHF = (lfhfRatio: number): number => {
    const logValue = Math.log10(lfhfRatio);
    const min = -0.7;
    const max = 0.9;
    return normalizeMinMax(logValue, min, max);
};

/**
 * Calculate the overall HRV Score (0-100) as a composite of key HRV metrics
 */
const calculateHrvScore = (metrics: {
    rmssd: number | null;
    sdnn: number | null;
    meanHR: number | null;
    rmssdStart: number | null;
    rmssdEnd: number | null;
    coherence: number | null;
    restoration: number | null;
}): number | null => {
    const { rmssd, sdnn, meanHR, rmssdStart, rmssdEnd, coherence, restoration } = metrics;
    
    // Check if we have the minimum required metrics
    if (rmssd === null || sdnn === null || meanHR === null) {
        return null;
    }
    
    try {
        // Normalize RMSSD (10-120 ms range, higher is better)
        const rmssdScore = normalizeMinMax(rmssd, 10, 120);
        
        // Normalize SDNN (10-150 ms range, higher is better)
        const sdnnScore = normalizeMinMax(sdnn, 10, 150);
        
        // Invert heart rate (lower HR is better for HRV)
        const hrScore = normalizeMinMax(110 - meanHR, 0, 70); // Assuming 40-110 BPM range
        
        // RMSSD trend (positive trend is better)
        let trendScore = 0.5; // Neutral
        if (rmssdStart !== null && rmssdEnd !== null && rmssdStart > 0) {
            const trend = (rmssdEnd - rmssdStart) / rmssdStart;
            trendScore = Math.max(0, Math.min(1, 0.5 + trend * 2)); // Normalize to 0-1
        }
        
        // Coherence component (if available)
        const coherenceScore = coherence !== null ? coherence / 100 : 0.5;
        
        // Restoration component (if available)
        const restorationScore = restoration !== null ? restoration / 100 : 0.5;
        
        // Calculate composite HRV score
        const hrvScore = 
            0.25 * rmssdScore +
            0.20 * sdnnScore +
            0.20 * hrScore +
            0.15 * trendScore +
            0.10 * coherenceScore +
            0.10 * restorationScore;
        
        return Number((hrvScore * 100).toFixed(1));
        
    } catch (error) {
        console.error('Error calculating HRV score:', error);
        return null;
    }
};

/**
 * Calculate the 4 main scores (Energy, Stress, Health, Focus) from HRV metrics
 */
const calculateFourScores = (metrics: {
    rmssd: number | null;
    sdnn: number | null;
    meanHR: number | null;
    lfhfRatio: number | null;
    bsi: number | null;
    totalPower: number | null;
    sleepRecovery?: number;
    shortTermRRStd?: number | null;
}): {
    energyScore: number | null;
    stressScore: number | null;
    healthScore: number | null;
    focusScore: number | null;
} => {
    const {
        rmssd,
        sdnn,
        meanHR,
        lfhfRatio,
        bsi,
        totalPower,
        sleepRecovery = 0.6,
        shortTermRRStd
    } = metrics;

    // Check if we have the minimum required metrics
    if (rmssd === null || sdnn === null || meanHR === null) {
        return {
            energyScore: null,
            stressScore: null,
            healthScore: null,
            focusScore: null
        };
    }

    try {
        // Define normalization ranges
        const RMSSD_MIN = 10;
        const RMSSD_MAX = 120;
        const SDNN_MIN = 10;
        const SDNN_MAX = 150;
        const HR_MIN = 40;
        const HR_MAX = 110;
        const BSI_MIN = 10;
        const BSI_MAX = 120;
        const TOTAL_POWER_MIN = 100;
        const TOTAL_POWER_MAX = 5000;

        // Calculate normalized components
        const p_RMSSD = normalizeMinMax(rmssd, RMSSD_MIN, RMSSD_MAX);
        const p_SDNN = normalizeMinMax(sdnn, SDNN_MIN, SDNN_MAX);
        const p_HR = normalizeMinMax(HR_MAX - meanHR, 0, HR_MAX - HR_MIN); // Inverted: higher HR reduces score
        const p_totalPower = totalPower ? normalizeMinMax(totalPower, TOTAL_POWER_MIN, TOTAL_POWER_MAX) : 0.5;

        // Calculate LF/HF normalization
        let p_LFHF = 0.5; // Default neutral value
        if (lfhfRatio !== null && lfhfRatio > 0) {
            p_LFHF = normalizeLFHF(lfhfRatio);
        }

        // Calculate BSI normalization
        let p_BSI = 0.5; // Default neutral value
        if (bsi !== null) {
            p_BSI = normalizeMinMax(bsi, BSI_MIN, BSI_MAX);
        }

        // Calculate Energy Score
        const energyRaw = 0.5 * p_RMSSD + 0.25 * p_SDNN + 0.15 * p_HR + 0.10 * p_totalPower;
        const energyScore = Math.max(0, Math.min(100, energyRaw * 100));

        // Calculate Stress Score
        const stressRaw = 0.5 * (1 - p_RMSSD) + 0.25 * p_BSI + 0.25 * p_LFHF;
        const stressScore = Math.max(0, Math.min(100, stressRaw * 100));

        // Calculate Health Score
        const healthRaw = 0.4 * p_SDNN + 0.3 * p_RMSSD + 0.2 * sleepRecovery + 0.1 * p_HR;
        const healthScore = Math.max(0, Math.min(100, healthRaw * 100));

        // Calculate Focus Score
        let focusScore = null;
        if (shortTermRRStd !== null && shortTermRRStd !== undefined) {
            const arousal = p_HR;
            const stability = 1 - normalizeMinMax(shortTermRRStd, 0, 50);
            const focusRaw = 0.6 * arousal + 0.4 * stability;
            
            let adjustedFocus = focusRaw;
            if (stressScore > 70) {
                adjustedFocus *= 0.7;
            }
            if (meanHR > 90) {
                adjustedFocus *= 0.8;
            }
            
            focusScore = Math.max(0, Math.min(100, adjustedFocus * 100));
        } else {
            // Fallback calculation without short-term variability
            const arousal = p_HR;
            const stability = p_RMSSD; // Use RMSSD as stability proxy
            const focusRaw = 0.6 * arousal + 0.4 * stability;
            
            let adjustedFocus = focusRaw;
            if (stressScore > 70) {
                adjustedFocus *= 0.7;
            }
            if (meanHR > 90) {
                adjustedFocus *= 0.8;
            }
            
            focusScore = Math.max(0, Math.min(100, adjustedFocus * 100));
        }

        return {
            energyScore: Number(energyScore.toFixed(1)),
            stressScore: Number(stressScore.toFixed(1)),
            healthScore: Number(healthScore.toFixed(1)),
            focusScore: Number(focusScore.toFixed(1))
        };

    } catch (error) {
        console.error('Error calculating four scores:', error);
        return {
            energyScore: null,
            stressScore: null,
            healthScore: null,
            focusScore: null
        };
    }
};

// Additional calculation functions
const START_END_WINDOW_SECONDS = 120;
const STABILITY_WINDOW_SECONDS = 30;
const STABILITY_STEP_SECONDS = 5;
const STABILITY_THRESHOLD_BPM = 5;
const MAX_TIME_TO_STABILIZE_SECONDS = 900;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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

    const windowSizeMs = 30 * 1000; // Use 30-second windows for shorter sessions
    const endTimestamp = rrSeries[rrSeries.length - 1].timestamp;
    const sessionEndTimestamp = sessionStartTimestamp + (endTimestamp - sessionStartTimestamp);

    // Calculate RMSSD windows
    const rmssdWindows: number[] = [];
    
    for (let windowStart = sessionStartTimestamp; windowStart < sessionEndTimestamp - windowSizeMs; windowStart += windowSizeMs) {
        const windowEnd = windowStart + windowSizeMs;
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

// Helper functions for session summary
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

    // Calculate existing metrics
    const rmssdSession = calculateRMSSD(rrValues);
    const sdnnSession = calculateSDNN(rrValues);
    const pnn50 = calculatePNN50(rrValues);
    const meanHr = calculateMeanHR(rrValues);
    const { amode50, AMo50Count } = calculateAMoMetrics(rrValues);
    const mxDmN = calculateMxDMn(rrValues);
    const rrMax = rrValues.length ? Math.max(...rrValues) : null;
    const rrMin = rrValues.length ? Math.min(...rrValues) : null;
    
    // Calculate mean RR in milliseconds
    const meanRR = rrValues.length ? rrValues.reduce((sum, rr) => sum + rr, 0) / rrValues.length : null;
    
    // Calculate new frequency domain metrics
    const frequencyMetrics = calculateFrequencyDomain(rrValues);
    
    // Calculate Poincaré plot metrics
    const poincareMetrics = calculatePoincareMetrics(rrValues);
    
    // Calculate full Baevsky metrics
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
    const hrvStability = computeHrvStability(rrSeries, sessionStartTimestamp);

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
        lfhfRatio: frequencyMetrics.lfhfRatio,
        bsi: baevskyMetrics.bsi,
        totalPower: frequencyMetrics.totalPower,
        sleepRecovery: 0.6, // Default value - can be made configurable later
        shortTermRRStd: null // Not available in current data structure
    });

    // Calculate overall HRV score
    const hrvScore = calculateHrvScore({
        rmssd: rmssdSession,
        sdnn: sdnnSession,
        meanHR: meanHr,
        rmssdStart: rmssdStart,
        rmssdEnd: rmssdEnd,
        coherence: respCoherence,
        restoration: restorationIndex
    });

    return {
        session_id: sessionId,
        user_id: userId,
        
        // Existing time-domain metrics
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
        
        // New time-domain metrics
        mean_rr_ms: meanRR !== null ? Number(meanRR.toFixed(2)) : null,
        
        // Frequency-domain metrics
        lf_power_ms2: frequencyMetrics.lfPower,
        hf_power_ms2: frequencyMetrics.hfPower,
        lfhf_ratio: frequencyMetrics.lfhfRatio,
        total_power_ms2: frequencyMetrics.totalPower,
        
        // Poincaré plot metrics
        sd1_ms: poincareMetrics.sd1,
        sd2_ms: poincareMetrics.sd2,
        sd2_sd1_ratio: (poincareMetrics.sd1 !== null && poincareMetrics.sd1 !== undefined && poincareMetrics.sd2 !== null && poincareMetrics.sd2 !== undefined && poincareMetrics.sd1 > 1e-6) 
            ? Number((poincareMetrics.sd2 / poincareMetrics.sd1).toFixed(4)) 
            : null,
        
        // === NEW BALANCE PERCENTAGE LOGIC ===
        // Based on your provided SD2/SD1 formula
        ...(() => {
            const sd2_sd1_ratio = (poincareMetrics.sd1 !== null && poincareMetrics.sd1 !== undefined && poincareMetrics.sd2 !== null && poincareMetrics.sd2 !== undefined && poincareMetrics.sd1 > 1e-6) 
                ? Number((poincareMetrics.sd2 / poincareMetrics.sd1).toFixed(4)) 
                : null;
            
            let balanceIndexX: number | null = null;
            if (sd2_sd1_ratio !== null && sd2_sd1_ratio > 0) {
                const BALANCE_DOMAIN: readonly [number, number] = [0, 200] as const;
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
                sd1_sd2_balance_score_nbs: normalizedBalanceScore,
                sd1_sd2_parasympathetic_percent: parasympatheticPercent,
                sd1_sd2_sympathetic_percent: sympatheticPercent,
            };
        })(),
        // === END NEW LOGIC ===
        
        // Full Baevsky Stress Index components
        baevsky_mo: baevskyMetrics.mo,
        baevsky_amo: baevskyMetrics.amo,
        baevsky_mxdmn_ms: baevskyMetrics.mxdmn,
        baevsky_stress_index: baevskyMetrics.bsi,
        
        // === NEW SD2/SD1-based Balance Percentages ===
        // (already included above via IIFE)
        // === END NEW ===
        
        // New 4-Score metrics
        energy_score: fourScores.energyScore,
        stress_score: fourScores.stressScore,
        health_score: fourScores.healthScore,
        focus_score: fourScores.focusScore,
        
        // Overall HRV Score
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
