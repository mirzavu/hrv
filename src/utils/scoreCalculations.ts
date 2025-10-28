// Score calculation functions

/**
 * Normalize a value to [0,1] range using min-max normalization
 */
export const normalizeMinMax = (value: number, min: number, max: number): number => {
    if (max === min) return 0.5; // Avoid division by zero
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
};

/**
 * Normalize LF/HF ratio using log scale
 */
export const normalizeLFHF = (lfhfRatio: number): number => {
    const logValue = Math.log10(lfhfRatio);
    const min = -0.7;
    const max = 0.9;
    return normalizeMinMax(logValue, min, max);
};

/**
 * Calculate the overall HRV Score (0-100) as a composite of key HRV metrics
 */
export const calculateHrvScore = (metrics: {
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
export const calculateFourScores = (metrics: {
    rmssd: number | null;
    sdnn: number | null;
    meanHR: number | null;
    bsi: number | null;
    totalPower: number | null;
    sleepRecovery?: number;
    shortTermRRStd?: number | null;
    sd1?: number | null;
    sd2?: number | null;
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
        bsi,
        totalPower,
        sleepRecovery = 0.6,
        shortTermRRStd,
        sd1,
        sd2
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

        // Calculate BSI normalization
        let p_BSI = 0.5; // Default neutral value
        if (bsi !== null) {
            p_BSI = normalizeMinMax(bsi, BSI_MIN, BSI_MAX);
        }

        // Calculate Energy Score
        const energyRaw = 0.5 * p_RMSSD + 0.25 * p_SDNN + 0.15 * p_HR + 0.10 * p_totalPower;
        const energyScore = Math.max(0, Math.min(100, energyRaw * 100));

        // Calculate Stress Score using new two-factor model
        // Option 1: A two-factor model with nonlinear analysis
        // RMSSD (60%) + SD1/SD2 ratio (40%)
        let stressScore = null;
        
        if (sd1 !== null && sd1 !== undefined && sd2 !== null && sd2 !== undefined && sd1 > 1e-6) {
            // Calculate SD1/SD2 ratio (inverse of SD2/SD1)
            const sd1_sd2_ratio = sd1 / sd2;
            
            // Define normalization ranges for SD1/SD2 ratio
            // Based on typical Poincaré plot values where:
            // - Lower SD1/SD2 indicates higher stress (more sympathetic)
            // - Higher SD1/SD2 indicates lower stress (more parasympathetic)
            const SD1_SD2_MIN = 0.1;  // Typical minimum for high stress
            const SD1_SD2_MAX = 1.0;  // Typical maximum for low stress
            
            // Normalize SD1/SD2 ratio
            const p_SD1_SD2 = normalizeMinMax(sd1_sd2_ratio, SD1_SD2_MIN, SD1_SD2_MAX);
            
            // Calculate stress score: lower ratios = higher stress
            // Formula: Stress Score = (0.60 * (1 - p_RMSSD)) + (0.40 * (1 - p_SD1/SD2))
            const stressRaw = 0.60 * (1 - p_RMSSD) + 0.40 * (1 - p_SD1_SD2);
            stressScore = Math.max(0, Math.min(100, stressRaw * 100));
        } else {
            // Fallback to RMSSD-only stress calculation if SD1/SD2 unavailable
            const stressRaw = 1 - p_RMSSD; // 100% RMSSD weight as fallback
            stressScore = Math.max(0, Math.min(100, stressRaw * 100));
        }

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

