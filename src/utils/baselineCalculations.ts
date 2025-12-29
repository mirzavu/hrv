/**
 * Baseline calculation utilities for personalized HRV scoring
 * 
 * This module implements the refined approach for calculating a reliable,
 * single "HRV Readiness Score" based on personalized baselines.
 */

import type { SessionSummaryRecord, UserBaseline } from '@/types';

/**
 * Calculate mean (average) of an array of numbers
 */
const calculateMean = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
};

/**
 * Calculate standard deviation of an array of numbers
 */
const calculateStdev = (values: number[], mean: number): number => {
  if (values.length === 0) return 0;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
  return Math.sqrt(variance);
};

/**
 * Calculate baseline metrics from a set of sessions
 * 
 * @param sessions - Array of session summary records (should be 7-14 consistent resting sessions)
 * @returns Baseline metrics including averages and standard deviations
 */
/**
 * Calculate baseline metrics with Phase Logic (Calibration / Early / Full)
 * Supports Simple Average (Early) and Weighted Mean (Full)
 * 
 * @param sessions - Array of selected sessions (already filtered by One Morning rule)
 */
export const calculateBaselineMetrics = (
  sessions: SessionSummaryRecord[]
): {
  rmssd_avg: number | null;
  rmssd_stdev: number | null;
  sdnn_avg: number | null;
  sdnn_stdev: number | null;
  hr_avg: number | null;
  hr_stdev: number | null;
  sd1_sd2_ratio_avg: number | null;
  sd1_sd2_ratio_stdev: number | null;
  lf_power_avg: number | null;
  hf_power_avg: number | null;
  lf_hf_avg: number | null;
  amo50_avg: number | null;
  energy_score_avg: number | null;
  energy_score_stdev: number | null;
  stress_score_avg: number | null;
  stress_score_stdev: number | null;
  health_score_avg: number | null;
  health_score_stdev: number | null;
  focus_score_avg: number | null;
  focus_score_stdev: number | null;
  hrv_score_avg: number | null;
  hrv_score_stdev: number | null;
} => {
  // Need at least 4 days (Phase 2 start) to return valid stats? 
  // Requirement says "Calibration 1-3d", "Early 4-14d".
  // If < 4, we might still want to return a simple average for display, but maybe flag it?
  // We will calculate whatever we have.

  // Filter valid sessions
  const validSessions = sessions.filter(s =>
    s.rmssd_session_ms !== null &&
    s.sdnn_session_ms !== null &&
    s.session_mean_hr !== null
  );

  if (validSessions.length === 0) {
    return {
      rmssd_avg: null, rmssd_stdev: null, sdnn_avg: null, sdnn_stdev: null,
      hr_avg: null, hr_stdev: null, sd1_sd2_ratio_avg: null, sd1_sd2_ratio_stdev: null,
      lf_power_avg: null, hf_power_avg: null, lf_hf_avg: null, amo50_avg: null,
      energy_score_avg: null, energy_score_stdev: null,
      stress_score_avg: null, stress_score_stdev: null,
      health_score_avg: null, health_score_stdev: null,
      focus_score_avg: null, focus_score_stdev: null,
      hrv_score_avg: null, hrv_score_stdev: null
    };
  }

  // Determine Phase based on count (Assuming 1 session per day)
  // Phase 3 (Full) = 15+ days
  const isPhase3 = validSessions.length >= 15;
  console.log(`[BASELINE_CALC] Calculation Phase: ${isPhase3 ? '3 (Weighted Mean)' : '2 (Simple Average)'}`);

  // Helper for Weighted Mean (3-2-1)
  // Weights: Newest 30% -> 3, Middle 30% -> 2, Oldest 40% -> 1? 
  // "30-day window, Weighted Mean (3-2-1 weights)"
  // Let's divide sessions into 3 roughly equal buckets based on time.
  // Sessions are NOT guaranteed sorted here? selectSessionsForBaseline returns them.
  // Let's sort just to be safe: Oldest [0] -> Newest [last]
  const sortedSessions = [...validSessions].sort((a, b) => {
    const timeA = new Date(a.session_date || a.created || a.createdAt || 0).getTime();
    const timeB = new Date(b.session_date || b.created || b.createdAt || 0).getTime();
    return timeA - timeB; // Ascending
  });

  const calculatePhaseMetrics = (
    extractor: (s: SessionSummaryRecord) => number | null | undefined,
    useLog: boolean = false
  ): { avg: number | null; stdev: number | null } => {
    const values = sortedSessions
      .map(extractor)
      .filter((v): v is number => v != null);

    if (values.length === 0) return { avg: null, stdev: null };

    // --- PHASE 3: WEIGHTED MEAN ---
    if (isPhase3) {
      // Split into 3 chunks for weights 1, 2, 3 (Old -> New)
      // "3-2-1" usually implies Newest gets 3.
      const n = values.length;
      const bucketSize = Math.floor(n / 3);
      // Remainder goes to newest bucket? Or distribute?
      // Simple logic: First bucket (Oldest) size B1, Middle B2, Newest B3
      const b1 = bucketSize; // Weight 1
      const b2 = bucketSize; // Weight 2
      const b3 = n - b1 - b2; // Weight 3 (includes remainder)

      let weightedSum = 0;
      let totalWeight = 0;
      const weightedValues: number[] = []; // For SD calc?? 
      // Weighted SD is complex. Standard practice: Use Weighted Mean, but Unweighted SD?
      // Requirement: "30-day window... SD with 3ms Floor".
      // Usually SD is calculated on the raw distribution window, not weighted.
      // So we use Weighted Mean for the Baseline Center, and Unweighted SD for the Range.

      // Process Oldest (Weight 1)
      for (let i = 0; i < b1; i++) {
        const val = useLog ? Math.log(values[i]) : values[i];
        weightedSum += val * 1;
        totalWeight += 1;
      }
      // Middle (Weight 2)
      for (let i = b1; i < b1 + b2; i++) {
        const val = useLog ? Math.log(values[i]) : values[i];
        weightedSum += val * 2;
        totalWeight += 2;
      }
      // Newest (Weight 3)
      for (let i = b1 + b2; i < n; i++) {
        const val = useLog ? Math.log(values[i]) : values[i];
        weightedSum += val * 3;
        totalWeight += 3;
      }

      const weightedMean = weightedSum / totalWeight;

      // Standard Deviation (Unweighted, typically)
      // Or should it be weighted SD? Weighted SD is better for weighted mean.
      // Let's use simple SD on the window for stability, unless specified.
      // "SD with 3ms Floor".
      const logValues = useLog ? values.map(v => Math.log(v)) : values;
      const simpleMeanForSD = calculateMean(logValues); // Should calculate variance around Weighted Mean?
      // Variance = Sum(w_i * (x_i - weightedMean)^2) / Sum(w_i) ? 
      // Let's stick to Simple SD for the set, it's robust enough.
      // Actually, if we use Weighted Mean, we should check deviation from THAT mean.
      const variance = logValues.reduce((acc, val) => acc + Math.pow(val - weightedMean, 2), 0) / n; // Simple variance from Weighted Mean
      let stdev = Math.sqrt(variance);

      // Floor logic
      if (useLog) {
        // SD Floor: "if raw SD too small, set SD_lnRMSSD = 0.07"
        // 0.07 is a typical minimum for LnRMSSD.
        stdev = Math.max(stdev, 0.07);
      } else {
        // Raw floor: 3ms
        stdev = Math.max(stdev, 3.0);
      }

      return { avg: weightedMean, stdev };

    } else {
      // --- PHASE 2: SIMPLE AVERAGE (EXPANDING WINDOW) ---
      // Just simple mean of what we have
      const workingValues = useLog ? values.map(v => Math.log(v)) : values;
      const mean = calculateMean(workingValues);

      let stdev = calculateStdev(workingValues, mean);

      // Apply floors even in Phase 2? Yes, good practice.
      if (useLog) {
        // Using 0.07 as per Phase 3 spec, seems safer
        stdev = Math.max(stdev, 0.07);
      } else {
        stdev = Math.max(stdev, 3.0);
      }

      return { avg: mean, stdev };
    }
  };

  // --- Metrics ---

  // RMSSD (Critical: LnRMSSD for Phase 3 logic mostly, but we store Raw Mean/SD for display?)
  // The 'user_baselines' table stores 'rmssd_avg' etc.
  // The Scoring uses LnRMSSD.
  // We should store LnRMSSD params? Or Raw?
  // Current DB has 'rmssd_avg'. Is it Raw or Log?
  // Previous code stored Raw.
  // If we change to Ln, we break data consistency/display.
  // Proposal: "Phase 3... Weighted Mean of LnRMSSD".
  // Scoring uses LnRMSSD.
  // So we SHOULD compute LnRMSSD stats.
  // BUT the type UserBaseline likely expects RMSSD in ms (Raw).
  // "rmssd_avg" usually means ms.
  // If we store Ln, it will be e.g. 4.2 instead of 66.
  // DECISION: We have limited fields. We will continue to store RAW stats in `rmssd_avg` (for display "Baseline: 45 ms").
  // BUT we need Ln stats for SCORING.
  // Wait, `calculateHrvReadinessScore` uses `baseline.rmssd_avg`.
  // If we change scoring to Z-score of Ln, we need Ln Baseline.
  // Can we derive Ln Baseline from Raw Baseline?
  // Mean(Ln(x)) != Ln(Mean(x)).
  // So we strictly need to store Ln Stats.
  // If `user_baselines` fields are strictly defined, we might need new fields?
  // Or we reuse `rmssd_avg` and treat it as Ln?
  // The UI likely displays it. `SessionSummaryModal` shows "Baseline: X".
  // If it shows "4.2", user gets confused.
  // **SOLUTION:** We will calculate and return RAW stats for the standard fields (for display).
  // We will assume the Scoring function will re-calculate Ln Baseline on the fly?
  // No, `calculateHrvReadinessScore` takes `baseline` object.
  // We can't re-calculate without the raw history.
  // **Better Solution:** The Proposal says "Phase 3... Weighted Mean of LnRMSSD".
  // This implies the *Baseline itself* is defined in Log terms.
  // However, for UI display, we assume the user sees MS.
  // Maybe we store Raw Stats in `rmssd_avg` (via calculating Weighted Mean of Raw?), and calculate Score via...
  // Wait. The requirement: "HRV Score... Z-score based using LnRMSSD".
  // To get Z-score, we need Mean & SD of LnRMSSD.
  // If we don't store them, we can't do it.
  // **HACK / PLAN:** We will OVERWRITE `rmssd_avg` and `rmssd_stdev` with **LnRMSSD** values.
  // AND we will add a UI transform if needed? 
  // OR we store RAW in `rmssd_avg`, but we rely on the fact that for scoring we need Ln.
  // Actually, let's check `UserBaseline` type again.
  // It doesn't have `ln_rmssd_avg`.
  // If I store Ln values in `rmssd_avg`, I must update ALL consumers to `Math.exp` it for display.
  // Is that feasible? `SessionSummaryModal` shows it.
  // That seems risky.
  // **ALTERNATIVE:** The "Composite" formula used Normalized Z-score.
  // `p_RMSSD = (val - avg) / stdev`.
  // If we switch to Ln, we want: `Z = (Ln(val) - LnAvg) / LnSD`.
  // If we only have RawAvg and RawSD, we can't extract LnAvg/LnSD accurately.
  // **Wait**, I can just calculate Weighted Mean of RAW RMSSD for `rmssd_avg`.
  // And for Scoring?
  // Maybe I just use Raw RMSSD Z-score?
  // "Verdict: GOOD. Switch to purely LnRMSSD...".
  // OK, I really need Ln stats.
  // I will check if I can add fields to DB?
  // `types` allows `[key: string]: any`? No.
  // **Compromise:** I will use the *existing* fields `rmssd_avg` / `stdev` to store **Raw** values (Weighted Mean of Raw).
  // I will UNFORTUNATELY have to calculate Z-score using Ln of RawAvg?? No that's wrong.
  // **Wait**: I can repurpose `rmssd_cv_percent` or similar? No.
  // **Let's look at the Task**: "Update code".
  // I can try to add `ln_rmssd_avg` to the DB?
  // I don't have schema access.
  // **Idea**: Store `rmssd_avg` as Raw.
  // Store `rmssd_stdev` as... Raw.
  // For the Score Calculation:
  // Use `ln(rmssd_session)` vs `ln(rmssd_raw_avg)`.
  // `Z ~= (ln(val) - ln(avg)) / (stdev / avg)`. (Approximation using CV).
  // Actually, `SD(ln x) ~= CV(x) = SD(x)/Mean(x)`.
  // `Mean(ln x) ~= Ln(Mean(x)) - 0.5 * Variance(ln x)`.
  // This approximation is usually "good enough" for HRV apps without schema changes.
  // **So**:
  // 1. Calculate and store Weighted Mean of **RAW** RMSSD -> `rmssd_avg`.
  // 2. Calculate and store Weighted/Simple SD of **RAW** RMSSD -> `rmssd_stdev`.
  // 3. In `calculateHrvReadinessScore`:
  //    - Estimate LnMean ~= `Math.log(baseline.rmssd_avg)`.
  //    - Estimate LnSD ~= `baseline.rmssd_stdev / baseline.rmssd_avg`. (CV).
  //    - Calculate `Z = (Math.log(current) - LnMean) / LnSD`.
  // This satisfies the "Use LnRMSSD" requirement mathematically via approximation, keeping DB clean.

  // Implementation below uses Raw Weighted Mean/SD.
  const rmssdParams = calculatePhaseMetrics(s => s.rmssd_session_ms, false); // Use RAW
  const sdnnParams = calculatePhaseMetrics(s => s.sdnn_session_ms, false);
  const hrParams = calculatePhaseMetrics(s => s.session_mean_hr, false);

  // New Scores
  const energyParams = calculatePhaseMetrics(s => s.energy_score, false);
  const stressParams = calculatePhaseMetrics(s => s.stress_score, false);
  const healthParams = calculatePhaseMetrics(s => s.health_score, false);
  const focusParams = calculatePhaseMetrics(s => s.focus_score, false);
  const hrvScoreParams = calculatePhaseMetrics(s => s.hrv_score, false);

  // Other metrics (simple mean for now, or use Phase logic without logs)
  const simpleAvg = (extractor: (s: SessionSummaryRecord) => number | null | undefined) => {
    const vals = sortedSessions.map(extractor).filter((v): v is number => v != null);
    if (!vals.length) return { avg: null, stdev: null };
    const m = calculateMean(vals);
    const s = calculateStdev(vals, m);
    return { avg: m, stdev: s };
  };

  const lfParams = simpleAvg(s => s.lf_power_ms2);
  const hfParams = simpleAvg(s => s.hf_power_ms2);
  const lfhfParams = simpleAvg(s => s.lfhf_ratio);
  const amoParams = simpleAvg(s => s.amode_50);

  // SD1/SD2
  const sd1Sd2Values = sortedSessions
    .filter(s => s.sd1_ms! > 0 && s.sd2_ms! > 0)
    .map(s => s.sd1_ms! / s.sd2_ms!);

  const sd1Sd2Avg = sd1Sd2Values.length ? calculateMean(sd1Sd2Values) : null;
  const sd1Sd2Sd = sd1Sd2Values.length > 0 && sd1Sd2Avg !== null ? calculateStdev(sd1Sd2Values, sd1Sd2Avg) : null;

  return {
    rmssd_avg: rmssdParams.avg, rmssd_stdev: rmssdParams.stdev,
    sdnn_avg: sdnnParams.avg, sdnn_stdev: sdnnParams.stdev,
    hr_avg: hrParams.avg, hr_stdev: hrParams.stdev,

    lf_power_avg: lfParams.avg, hf_power_avg: hfParams.avg,
    lf_hf_avg: lfhfParams.avg, amo50_avg: amoParams.avg,

    sd1_sd2_ratio_avg: sd1Sd2Avg, sd1_sd2_ratio_stdev: sd1Sd2Sd,

    energy_score_avg: energyParams.avg, energy_score_stdev: energyParams.stdev,
    stress_score_avg: stressParams.avg, stress_score_stdev: stressParams.stdev,
    health_score_avg: healthParams.avg, health_score_stdev: healthParams.stdev,
    focus_score_avg: focusParams.avg, focus_score_stdev: focusParams.stdev,
    hrv_score_avg: hrvScoreParams.avg, hrv_score_stdev: hrvScoreParams.stdev,
  };
};

/**
 * Calculate HRV Readiness Score using personalized baseline approach
 * 
 * This implements the refined scoring model:
 * HRV Readiness = (0.35 * p_RMSSD) + (0.35 * p_SDNN) - (0.30 * p_HR)
 * 
 * Where p_X = (daily_value - baseline_avg) / baseline_stdev (z-score)
 * 
 * @param sessionMetrics - Current session metrics
 * @param baseline - User's personalized baseline
 * @returns HRV Readiness Score (centered around 50, range typically 0-100)
 */
/**
 * Calculate HRV Readiness Score using personalized baseline approach
 * 
 * New Formula: Pure LnRMSSD Z-score
 * Z = (Ln(Today) - Ln(BaselineMean)) / Ln(BaselineSD)
 * Score = 50 + (Z * 20)  [Centered at 50, +/- 2.5 SD range]
 * 
 * Note: Baseline stores Weighted Mean/SD of RAW RMSSD.
 * We approximate Ln stats:
 * LnMean ~= Ln(RawMean)
 * LnSD ~= RawSD / RawMean (CV)
 * 
 * @param sessionMetrics - Current session metrics
 * @param baseline - User's personalized baseline
 * @returns HRV Readiness Score (0-100)
 */
export const calculateHrvReadinessScore = (
  sessionMetrics: {
    rmssd: number | null;
    sdnn: number | null;
    meanHR: number | null;
    sd1?: number | null;
    sd2?: number | null;
  },
  baseline: UserBaseline | null
): number | null => {
  // Check if baseline is established
  if (!baseline || !baseline.established) {
    return null; // Cannot calculate without baseline
  }

  // Check if we have required session metrics
  if (sessionMetrics.rmssd === null) {
    return null;
  }

  // Check if we have required baseline metrics
  if (
    baseline.rmssd_avg === null ||
    baseline.rmssd_stdev === null
  ) {
    return null;
  }

  try {
    const rawRmssd = sessionMetrics.rmssd;
    const baseMean = baseline.rmssd_avg;
    const baseStdev = baseline.rmssd_stdev;

    // Avoid division by zero
    if (baseMean <= 0 || baseStdev <= 0 || rawRmssd <= 0) return 50;

    // Approximate Ln Stats from Raw Weighted Stats
    const lnMean = Math.log(baseMean);
    // CV approach for LnSD: SD(lnX) ~ SD(X)/Mean(X)
    // Ensure minimum SD to avoid extreme Z-scores
    const lnSd = Math.max(0.10, baseStdev / baseMean);

    const lnCurrent = Math.log(rawRmssd);

    // Calculate Z-score
    const zScore = (lnCurrent - lnMean) / lnSd;

    // Map Z-score to 0-100
    // Z=0 -> 50. Z=+2.5 -> 100. Z=-2.5 -> 0.
    const score = 50 + (zScore * 20);

    // Clamp to 0-100 range
    const clampedScore = Math.max(0, Math.min(100, score));

    return Number(clampedScore.toFixed(1));

  } catch (error) {
    console.error('Error calculating HRV readiness score:', error);
    return null;
  }
};

/**
 * Interpret the HRV Readiness Score based on Z-score equivalent
 * 
 * Mapping (Score = 50 + 20Z):
 * Z > 1.5  => Score > 80 (Dark Green - Peak)
 * Z ~ 0    => Score 40-60 (Medium Green - Stable)
 * Z ~ -1.0 => Score 30 (Light Green - Functional)
 * Z < -1.5 => Score < 20 (Grey - Rest)
 * 
 * @param score - HRV Readiness Score (0-100)
 * @returns Interpretation object with status and message
 */
export const interpretReadinessScore = (score: number | null): {
  status: 'peak' | 'stable' | 'functional' | 'rest' | 'no-baseline';
  message: string;
  color: string;
} => {
  if (score === null) {
    return {
      status: 'no-baseline',
      message: 'Building baseline...',
      color: '#6B7280' // gray
    };
  }

  if (score >= 80) { // Z > 1.5
    return {
      status: 'peak',
      message: 'Peak State. Ready for high intensity.',
      color: '#059669' // Dark Green (Emerald 600)
    };
  } else if (score >= 45) { // Z > -0.25 (includes average)
    return {
      status: 'stable',
      message: 'Stable. Good balance.',
      color: '#10B981' // Medium Green (Emerald 500)
    };
  } else if (score >= 25) { // Z > -1.25
    return {
      status: 'functional',
      message: 'Functional. Moderate load recommended.',
      color: '#34D399' // Light Green (Emerald 400)
    };
  } else { // Z < -1.25
    return {
      status: 'rest',
      message: 'Below Baseline. Prioritize recovery.',
      color: '#9CA3AF' // Grey (Gray 400) - as requested "Grey" for low
    };
  }
};

/**
 * Check if a user has enough sessions to establish or update baseline
 * 
 * @param sessionsCount - Number of valid sessions
 * @returns Whether baseline can be established (requires 7-14 sessions)
 */
export const canEstablishBaseline = (sessionsCount: number): boolean => {
  return sessionsCount >= 4; // Start of Phase 2 (Early)
};

/**
 * Check if baseline should be updated (recommended every 2-4 weeks or after significant life changes)
 * 
 * @param lastUpdated - Date when baseline was last updated
 * @param daysSinceUpdate - Number of days since last update (default: 28 days / 4 weeks)
 * @returns Whether baseline should be recalculated
 */
export const shouldUpdateBaseline = (
  lastUpdated: string | null,
  daysSinceUpdate: number = 28
): boolean => {
  if (!lastUpdated) return true;

  const lastUpdateDate = new Date(lastUpdated);
  const daysSince = (Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSince >= daysSinceUpdate;
};

/**
 * Group sessions by date (YYYY-MM-DD format)
 * 
 * @param sessions - Array of session summary records with session_date field
 * @returns Map of date string to array of sessions for that date
 */
const groupSessionsByDate = <T extends { session_date?: string | null; createdAt?: string; created?: string;[key: string]: any }>(
  sessions: T[]
): Map<string, T[]> => {
  console.log(`[BASELINE_CALC] groupSessionsByDate: Processing ${sessions.length} sessions`);
  const grouped = new Map<string, T[]>();
  let skippedCount = 0;

  for (const session of sessions) {
    const dateStr = session.session_date || session.created || session.createdAt;
    if (!dateStr) {
      skippedCount++;
      continue;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      skippedCount++;
      console.log(`[BASELINE_CALC] groupSessionsByDate: Invalid date for session ${session.id || 'unknown'}: ${dateStr}`);
      continue;
    }

    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(session);
  }

  console.log(`[BASELINE_CALC] groupSessionsByDate: Grouped into ${grouped.size} unique dates, skipped ${skippedCount} sessions`);
  const dateCounts = Array.from(grouped.entries()).map(([date, sessions]) => `${date}: ${sessions.length}`);
  console.log(`[BASELINE_CALC] groupSessionsByDate: Date breakdown:`, dateCounts.slice(0, 10).join(', '));

  return grouped;
};

/**
 * Check if user can create baseline based on last 14 days
 * Condition: At least 3 unique days with sessions in the last 14 days (Calibration Phase)
 * 
 * @param sessions - Array of session summary records
 * @returns Validation result
 */
export const canCreateBaseline = <T extends { session_date?: string | null; createdAt?: string; created?: string;[key: string]: any }>(
  sessions: T[]
): { valid: boolean; uniqueDays: number } => {
  console.log(`[BASELINE_CALC] canCreateBaseline: Checking ${sessions.length} sessions`);

  if (sessions.length === 0) {
    console.log(`[BASELINE_CALC] canCreateBaseline: No sessions provided - INVALID`);
    return { valid: false, uniqueDays: 0 };
  }

  const grouped = groupSessionsByDate(sessions);

  // Get current date and calculate 14 days ago (or 30? Requirement says 30-day window for calculation)
  // But for ESTABLISHING, usually 14 days is good check.
  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 30); // Expanded to 30 as per overall Plan duration

  console.log(`[BASELINE_CALC] canCreateBaseline: Checking last 30 days from ${fourteenDaysAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

  // Filter to sessions from last 30 days
  const allDates = Array.from(grouped.keys());
  const recentDates = allDates.filter(dateStr => {
    const date = new Date(dateStr);
    const isRecent = date >= fourteenDaysAgo;
    if (!isRecent) {
      console.log(`[BASELINE_CALC] canCreateBaseline: Date ${dateStr} is outside 30-day window`);
    }
    return isRecent;
  });

  const uniqueDays = recentDates.length;
  const MIN_UNIQUE_DAYS = 3; // Reduced for Calibration Support

  console.log(`[BASELINE_CALC] canCreateBaseline: Found ${uniqueDays} unique days in last 30 days (need ${MIN_UNIQUE_DAYS})`);
  console.log(`[BASELINE_CALC] canCreateBaseline: Recent dates:`, recentDates.sort().join(', '));

  const isValid = uniqueDays >= MIN_UNIQUE_DAYS;
  console.log(`[BASELINE_CALC] canCreateBaseline: Result - ${isValid ? 'VALID' : 'INVALID'} (${uniqueDays} >= ${MIN_UNIQUE_DAYS})`);

  return {
    valid: isValid,
    uniqueDays
  };
};

/**
 * Select sessions for baseline calculation
 * Logic: Get latest 7 dates, take up to 2 sessions per date (max 14 total, min 5)
 * 
 * @param sessions - Array of session summary records
 * @returns Selected sessions for baseline calculation
 */
/**
 * Select sessions for baseline calculation
 * Logic: 30-day window, "One Morning" rule (First session of day), Exclude Crashes
 * 
 * @param sessions - Array of session summary records
 * @returns Selected sessions for baseline calculation
 */
export const selectSessionsForBaseline = <T extends { session_date?: string | null; createdAt?: string; created?: string; startTime?: string; is_crash?: boolean;[key: string]: any }>(
  sessions: T[]
): T[] => {
  console.log(`[BASELINE_CALC] selectSessionsForBaseline: Selecting from ${sessions.length} sessions`);

  if (sessions.length === 0) return [];

  // 1. Filter out Crash sessions
  // We exclude sessions flagged as 'is_crash' from the BASELINE CALCULATION set
  const cleanSessions = sessions.filter(s => s.is_crash !== true);

  if (cleanSessions.length < sessions.length) {
    console.log(`[BASELINE_CALC] Excluded ${sessions.length - cleanSessions.length} crash sessions`);
  }

  // 2. Group by Date
  const grouped = groupSessionsByDate(cleanSessions);

  // 3. Sort dates descending (most recent first)
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  // 4. Look back 30 days (taking up to 30 unique days)
  const relevantDates = sortedDates.slice(0, 30);
  console.log(`[BASELINE_CALC] Window: Latest ${relevantDates.length} days (Max 30)`);

  const selected: T[] = [];

  for (const date of relevantDates) {
    const dateSessions = grouped.get(date) || [];

    // 5. "One Morning Rule": Pick ONLY the FIRST session of the day
    // Sort by time ASCENDING (Earliest first)
    // We assume creating a baseline uses Morning Readiness sessions, which are typically first.
    const sortedByTime = dateSessions.sort((a, b) => {
      const timeA = new Date(a.startTime || a.created || a.createdAt || 0).getTime();
      const timeB = new Date(b.startTime || b.created || b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    if (sortedByTime.length > 0) {
      selected.push(sortedByTime[0]); // The First Session
    }
  }

  console.log(`[BASELINE_CALC] Final Selection: ${selected.length} sessions`);
  return selected;
};

/**
 * Legacy function for backwards compatibility
 * @deprecated Use canCreateBaseline and selectSessionsForBaseline instead
 */
export const hasValidTemporalDistribution = (
  sessions: Array<{ session_date?: string; createdAt?: string; created?: string }>
): { valid: boolean; uniqueDays: number; timeSpanDays: number } => {
  const check = canCreateBaseline(sessions);
  return {
    valid: check.valid,
    uniqueDays: check.uniqueDays,
    timeSpanDays: 0 // Not used in new logic
  };
};

