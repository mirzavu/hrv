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
 * 
 * Used as fallback for users who don't have baseline established and for HRV CV calculation.
 * For personalized scoring with user baselines, use calculateHrvReadinessScore from baselineCalculations.ts
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
    const { rmssd, sdnn, meanHR } = metrics;

    // Check if we have the minimum required metrics
    if (rmssd === null || sdnn === null || meanHR === null) {
        return null;
    }

    try {
        // Simplified approach for backward compatibility
        // Used as fallback when personalized baseline is not available

        // Normalize RMSSD (10-120 ms range, higher is better)
        const rmssdScore = normalizeMinMax(rmssd, 10, 120);

        // Normalize SDNN (10-150 ms range, higher is better)
        const sdnnScore = normalizeMinMax(sdnn, 10, 150);

        // Invert heart rate (lower HR is better for HRV)
        const hrScore = normalizeMinMax(110 - meanHR, 0, 70); // Assuming 40-110 BPM range

        // Calculate simplified HRV score (matching new formula weights)
        // Formula: (0.35 * RMSSD) + (0.35 * SDNN) + (0.30 * inverted_HR)
        const hrvScore =
            0.35 * rmssdScore +
            0.35 * sdnnScore +
            0.30 * hrScore;

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
    hti?: number | null;
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
        sleepRecovery: _sleepRecovery = 0.6,
        shortTermRRStd: _shortTermRRStd,
        sd1,
        sd2,
        hti
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
        const _p_HR = normalizeMinMax(HR_MAX - meanHR, 0, HR_MAX - HR_MIN); // Inverted: higher HR reduces score
        const _p_totalPower = totalPower ? normalizeMinMax(totalPower, TOTAL_POWER_MIN, TOTAL_POWER_MAX) : 0.5;

        // Calculate BSI normalization
        let _p_BSI = 0.5; // Default neutral value
        if (bsi !== null) {
            _p_BSI = normalizeMinMax(bsi, BSI_MIN, BSI_MAX);
        }

        // Calculate Energy Score
        // Reflects overall readiness to perform based on recovery (parasympathetic) and activation (sympathetic)
        // RMSSD (50%) + SDNN (30%) + Resting Heart Rate inverted (20%)
        const p_RHR = normalizeMinMax(meanHR, HR_MIN, HR_MAX); // Normalize HR directly for inversion
        const energyRaw = 0.50 * p_RMSSD + 0.30 * p_SDNN + 0.20 * (1 - p_RHR);
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
        // Long-term indicator of general wellness and resilience
        // SDNN (50%) + SD1/SD2 ratio normalized around 1 (30%) + RHR inverted (20%)
        let healthScore = null;

        if (sd1 !== null && sd1 !== undefined && sd2 !== null && sd2 !== undefined && sd1 > 1e-6) {
            // Calculate SD1/SD2 ratio
            const sd1_sd2_ratio = sd1 / sd2;

            // Normalize around 1: ratio closer to 1 indicates better health
            // p_SD1/SD2 = 1 - abs(1 - (SD1/SD2))
            const p_SD1_SD2 = 1 - Math.abs(1 - sd1_sd2_ratio);

            // Calculate health score
            const healthRaw = 0.50 * p_SDNN + 0.30 * p_SD1_SD2 + 0.20 * (1 - p_RHR);
            healthScore = Math.max(0, Math.min(100, healthRaw * 100));
        } else {
            // Fallback: SDNN and RHR only if SD1/SD2 unavailable
            const healthRaw = 0.70 * p_SDNN + 0.30 * (1 - p_RHR);
            healthScore = Math.max(0, Math.min(100, healthRaw * 100));
        }

        // Calculate Focus Score
        // Assesses cognitive readiness and mental fatigue
        // RMSSD (70%) + HTI (30%)
        let focusScore = null;

        if (hti !== null && hti !== undefined && hti > 0) {
            // Define normalization range for HTI
            // Typical HTI values range from ~5 (low variability) to ~50+ (high variability)
            const HTI_MIN = 5;
            const HTI_MAX = 50;

            // Normalize HTI
            const p_HTI = normalizeMinMax(hti, HTI_MIN, HTI_MAX);

            // Focus Score: RMSSD (70%) + HTI (30%)
            const focusRaw = 0.70 * p_RMSSD + 0.30 * p_HTI;
            focusScore = Math.max(0, Math.min(100, focusRaw * 100));
        } else {
            // Fallback to RMSSD-only if HTI unavailable
            const focusRaw = p_RMSSD;
            focusScore = Math.max(0, Math.min(100, focusRaw * 100));
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

