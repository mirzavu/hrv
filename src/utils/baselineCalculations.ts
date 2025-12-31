/**
 * Baseline calculation utilities for personalized HRV scoring
 * 
 * This module implements the Optimized Scoring Logic:
 * - Weighted Engine (3-2-1 Tiering) on Ln Values
 * - Geometric Mean Storage
 * - Piecewise Z-Score Mapping
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
 * Calculate Weighted Mean and Standard Deviation (Weighted Engine)
 * 
 * Strategy:
 * - Values are expected to be Ln(raw) for HRV metrics to ensure normal distribution.
 * - Weights are assigned based on recency (Tiered 3-2-1).
 */
const calculateWeightedStats = (values: number[], daysSinceList: number[]): { mean: number; stdev: number } => {
  if (values.length === 0) return { mean: 0, stdev: 0 };

  let weightedSum = 0;
  let totalWeight = 0;
  let weightedSquaredDiffSum = 0;

  // 1. Calculate Weighted Mean
  values.forEach((val, i) => {
    const daysOld = daysSinceList[i]; // 0 = today/most recent
    let weight = 1;

    // Weighting Tiers (Optimized Logic)
    if (daysOld < 7) {         // Recent (0-6 days old): Tier 1
      weight = 3;
    } else if (daysOld < 14) { // Weeks 2 (7-13 days old): Tier 2
      weight = 2;
    } else {                   // Weeks 3-4 (14+ days old): Tier 3
      weight = 1;
    }

    weightedSum += val * weight;
    totalWeight += weight;
  });

  const weightedMean = weightedSum / totalWeight;

  // 2. Calculate Weighted Stdev (Standard Deviation around the Weighted Mean)
  // Note: For Z-score stability, we typically use the weighted variance.
  values.forEach((val, i) => {
    const daysOld = daysSinceList[i];
    let weight = 1;
    if (daysOld < 7) weight = 3;
    else if (daysOld < 14) weight = 2;
    else weight = 1;

    weightedSquaredDiffSum += weight * Math.pow(val - weightedMean, 2);
  });

  // Weighted Variance = Sum(w * (x - mean)^2) / Sum(w)
  // (Sample correction -1 is often omitted in simple HRV mobile keys, using population or large-weight approx)
  const weightedVariance = weightedSquaredDiffSum / totalWeight;
  const weightedStdev = Math.sqrt(weightedVariance);

  return { mean: weightedMean, stdev: weightedStdev };
};


/**
 * Calculate baseline metrics with Optimized Weighted Engine
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

  // Pre-calculate "Days Since" for weighting logic
  // Assumes sessions are passed relevant relative to "Now" or "Latest Session"
  // For baseline creation, we usually anchor to the *Latest Session Date* in the set 
  // (to prevent 'decay' if the user stopped tracking for a week, we want the relative weights to still apply to the data chunk).
  // OR we anchor to *Today*.
  // "30 days excluding today" suggests anchoring to Today.
  // Let's use Today as anchor.
  const now = new Date();

  // Map sessions to { val, daysOld } structure
  // We sort Newest -> Oldest for easy tier checking, or calculate absolute days.
  const sessionMeta = validSessions.map(s => {
    const d = new Date(s.session_date || s.created || s.createdAt || 0);
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return { session: s, daysOld };
  });

  const calculateLnMetrics = (
    extractor: (s: SessionSummaryRecord) => number | null | undefined
  ): { avg: number | null; stdev: number | null } => {
    const data = sessionMeta
      .filter(item => extractor(item.session) != null && extractor(item.session)! > 0)
      .map(item => ({ val: Math.log(extractor(item.session)!), days: item.daysOld }));

    if (data.length === 0) return { avg: null, stdev: null };

    const stats = calculateWeightedStats(data.map(d => d.val), data.map(d => d.days));

    // Store Geometric Mean (exp(meanLn)) to keep "ms" unit for UI display
    // Store LnSD directly in stdev field (re-purposing the field, but keeping number type)
    return {
      avg: Math.exp(stats.mean),
      stdev: stats.stdev
    };
  };

  const calculateLinearMetrics = (
    extractor: (s: SessionSummaryRecord) => number | null | undefined
  ): { avg: number | null; stdev: number | null } => {
    // For non-log metrics (Scores 0-100), we stick to linear weighted mean?
    // Or just simple mean?
    // Let's use Linear Weighted for consistency, but on raw values.
    const data = sessionMeta
      .filter(item => extractor(item.session) != null)
      .map(item => ({ val: extractor(item.session)!, days: item.daysOld }));

    if (data.length === 0) return { avg: null, stdev: null };

    const stats = calculateWeightedStats(data.map(d => d.val), data.map(d => d.days));
    return { avg: stats.mean, stdev: stats.stdev };
  };

  // --- Metrics ---

  // RMSSD & SDNN: Log-Normal distribution assumed -> Use Ln metrics
  const rmssdParams = calculateLnMetrics(s => s.rmssd_session_ms);
  const sdnnParams = calculateLnMetrics(s => s.sdnn_session_ms);

  // HR: Usually Normal, but sometimes Log-Normal. sticking to Linear for now or Ln?
  // Let's use Linear for HR to match "BPM" expectation in UI without complex transform.
  const hrParams = calculateLinearMetrics(s => s.session_mean_hr);

  // Scores: Already 0-100, linear
  const energyParams = calculateLinearMetrics(s => s.energy_score);
  const stressParams = calculateLinearMetrics(s => s.stress_score);
  const healthParams = calculateLinearMetrics(s => s.health_score);
  const focusParams = calculateLinearMetrics(s => s.focus_score);
  const hrvScoreParams = calculateLinearMetrics(s => s.hrv_score);

  const lfParams = calculateLinearMetrics(s => s.lf_power_ms2);
  const hfParams = calculateLinearMetrics(s => s.hf_power_ms2);
  const lfhfParams = calculateLinearMetrics(s => s.lfhf_ratio);
  const amoParams = calculateLinearMetrics(s => s.amode_50);

  // SD1/SD2
  const sd1Sd2Values = validSessions
    .filter(s => s.sd1_ms! > 0 && s.sd2_ms! > 0)
    .map(s => s.sd1_ms! / s.sd2_ms!);

  const sd1Sd2Avg = sd1Sd2Values.length ? calculateMean(sd1Sd2Values) : null;
  const sd1Sd2Sd = sd1Sd2Values.length > 0 && sd1Sd2Avg !== null ? calculateStdev(sd1Sd2Values, sd1Sd2Avg) : null;

  return {
    rmssd_avg: rmssdParams.avg, rmssd_stdev: rmssdParams.stdev, // Note: stdev is LnSD here
    sdnn_avg: sdnnParams.avg, sdnn_stdev: sdnnParams.stdev,     // Note: stdev is LnSD here
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
 * Calculate HRV Readiness Score using Optimized Scoring Logic
 * 
 * Formula: 
 * Z = (Ln(Today) - Ln(BaselineMean)) / Max(Ln(BaselineSD), 0.07)
 * 
 * Mapping Z to 0-100:
 * Z = 0    -> 70 (Normal)
 * Z = -1.5 -> 35 (Warning)
 * Z = -2.5 -> 10 (Crash)
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
  if (!baseline || !baseline.established) return null;
  if (sessionMetrics.rmssd === null) return null;
  if (baseline.rmssd_avg === null || baseline.rmssd_stdev === null) return null;

  try {
    const rawRmssd = sessionMetrics.rmssd;
    const baseGeomMean = baseline.rmssd_avg; // This is Exp(MeanLn)
    const baseLnSd = baseline.rmssd_stdev;   // This is SD(Ln)

    if (baseGeomMean <= 0 || rawRmssd <= 0) return 50;

    // 1. Calculate Log Transform
    // We stored GeomMean, so Ln(GeomMean) = WeightedMeanLn
    const baseMeanLn = Math.log(baseGeomMean);
    const currentLn = Math.log(rawRmssd);

    // 2. Sensitivity Floor
    // Floor of 3ms roughly maps to 0.07 in Ln space for typical HRV ranges
    const effectiveSd = Math.max(baseLnSd, 0.07);

    // 3. Z-Score
    const zScore = (currentLn - baseMeanLn) / effectiveSd;

    // 4. Piecewise Mapping
    // Points: (-2.5, 10), (-1.5, 35), (0, 70)
    // We need to extrapolate above 0 as well.
    // If Z=0 is 70, maybe Z=1.5 is 85 or 90?
    // Let's assume symmetry or linear extension for >0.
    // Let's use (0, 70) -> (1.5, 95) -> (2.5, 100)

    // Linear interpolation helper
    const lerp = (x: number, x0: number, x1: number, y0: number, y1: number) => {
      return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
    };

    let score = 70;

    if (zScore >= 0) {
      // High Readiness (0 to +Max)
      // Map 0->70, 2.0->100
      score = lerp(Math.min(zScore, 2.0), 0, 2.0, 70, 100);
    } else if (zScore >= -1.5) {
      // Normal to Warning
      // Map 0->70, -1.5->35
      score = lerp(zScore, -1.5, 0, 35, 70);
    } else if (zScore >= -2.5) {
      // Warning to Crash
      // Map -1.5->35, -2.5->10
      score = lerp(zScore, -2.5, -1.5, 10, 35);
    } else {
      // Crash Zone
      // Map -2.5->10 down to 0
      score = lerp(Math.max(zScore, -4.0), -4.0, -2.5, 0, 10);
    }

    return Number(Math.max(0, Math.min(100, score)).toFixed(0));

  } catch (error) {
    console.error('Error calculating HRV readiness score:', error);
    return null;
  }
};

/**
 * Interpret the HRV Readiness Score
 * NOTE: Frontend uses wellnessLogic.ts for display
 */
export const interpretReadinessScore = (score: number | null): {
  status: 'peak' | 'stable' | 'functional' | 'rest' | 'no-baseline';
  message: string;
  color: string;
} => {
  if (score === null) return { status: 'no-baseline', message: 'Building baseline...', color: '#6B7280' };

  if (score >= 90) return { status: 'peak', message: 'Optimal', color: '#059669' };
  if (score >= 70) return { status: 'stable', message: 'Ready', color: '#10B981' };
  if (score >= 35) return { status: 'functional', message: 'Strained', color: '#EAB308' };
  return { status: 'rest', message: 'Recover', color: '#EF4444' };
};

/**
 * Check if a user has enough sessions to establish or update baseline
 */
export const canEstablishBaseline = (sessionsCount: number): boolean => {
  return sessionsCount >= 3;
};

export const shouldUpdateBaseline = (
  lastUpdated: string | null,
  daysSinceUpdate: number = 28
): boolean => {
  if (!lastUpdated) return true;
  const lastUpdateDate = new Date(lastUpdated);
  const daysSince = (Date.now() - lastUpdateDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince >= daysSinceUpdate;
};

const groupSessionsByDate = <T extends { session_date?: string | null; createdAt?: string; created?: string;[key: string]: any }>(
  sessions: T[]
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  for (const session of sessions) {
    const dateStr = session.session_date || session.created || session.createdAt;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;
    const dateKey = date.toISOString().split('T')[0];
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(session);
  }
  return grouped;
};

export const canCreateBaseline = <T extends { session_date?: string | null; createdAt?: string; created?: string;[key: string]: any }>(
  sessions: T[]
): { valid: boolean; uniqueDays: number } => {
  if (sessions.length === 0) return { valid: false, uniqueDays: 0 };
  const grouped = groupSessionsByDate(sessions);
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const allDates = Array.from(grouped.keys());
  const recentDates = allDates.filter(dateStr => {
    const date = new Date(dateStr);
    return date >= thirtyDaysAgo;
  });

  return { valid: recentDates.length >= 3, uniqueDays: recentDates.length };
};

/**
 * Select sessions for baseline calculation
 * Logic: 30-day window, "One Morning" rule (First session of day)
 */
export const selectSessionsForBaseline = <T extends { session_date?: string | null; createdAt?: string; created?: string; startTime?: string; is_crash?: boolean;[key: string]: any }>(
  sessions: T[]
): T[] => {
  if (sessions.length === 0) return [];

  const cleanSessions = sessions.filter(s => s.is_crash !== true);
  const grouped = groupSessionsByDate(cleanSessions);
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const relevantDates = sortedDates.slice(0, 30);
  const selected: T[] = [];

  for (const date of relevantDates) {
    const dateSessions = grouped.get(date) || [];
    // One Morning Rule: Pick First
    const sortedByTime = dateSessions.sort((a, b) => {
      const timeA = new Date(a.startTime || a.created || a.createdAt || 0).getTime();
      const timeB = new Date(b.startTime || b.created || b.createdAt || 0).getTime();
      return timeA - timeB;
    });

    if (sortedByTime.length > 0) {
      selected.push(sortedByTime[0]);
    }
  }

  return selected;
};

export const hasValidTemporalDistribution = (
  sessions: Array<{ session_date?: string; createdAt?: string; created?: string }>
): { valid: boolean; uniqueDays: number; timeSpanDays: number } => {
  const check = canCreateBaseline(sessions);
  return { valid: check.valid, uniqueDays: check.uniqueDays, timeSpanDays: 0 };
};
