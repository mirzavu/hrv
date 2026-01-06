/**
 * Session Comparison Utilities for Calibration Phase (Days 1-3)
 * 
 * Provides functions for comparing sessions before baseline is established,
 * including time-gap-based comparison, crash detection, and interpretation generation.
 */

import type { SessionSummary, SessionSummaryRecord } from '@/types';
import type { InterpretationResult } from './autonomicInterpretation';

// 3ms Standard Deviation Floor constant
const SD_FLOOR_MS = 3.0;



// Time gap priority ranges (in hours)
const PRIORITY_RANGES = [
  { priority: 1, min: 20, max: 28, insightText: "Compared to your state roughly 1 day ago", metricTitle: "HRV Changes Since Yesterday" },
  { priority: 2, min: 28, max: 52, insightText: "Compared to your state roughly 2 days ago", metricTitle: "HRV Changes Since 2 Days Ago" },
  { priority: 3, min: 4, max: 20, insightText: "Since your earlier session in this cycle", metricTitle: "HRV Changes Since Last Session" },
  { priority: 4, min: 52, max: 240, insightText: "Compared to your state last week", metricTitle: "HRV Changes Since Last Week" },
] as const;

export interface ComparisonSessionResult {
  session: SessionSummaryRecord | null;
  timeGapHours: number;
  priority: number;
  insightText: string;
  metricTitle?: string;
}

export interface MetricChange {
  metric: string;
  label: string;
  current: number;
  previous: number;
  percentChange: number;
  absoluteChange: number;
  direction: 'up' | 'down' | 'stable';
}

export interface CrashDetectionResult {
  isCrash: boolean;
  zScore: number | null;
}

/**
 * Calculate time difference in hours between two dates
 */
function calculateTimeGapHours(currentDate: Date, previousDate: Date): number {
  const diffMs = currentDate.getTime() - previousDate.getTime();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Parse session date from various formats
 */
function parseSessionDate(session: SessionSummaryRecord): Date | null {
  if (session.session_date) {
    return new Date(session.session_date);
  }
  if (session.createdAt) {
    return new Date(session.createdAt);
  }
  return null;
}

/**
 * Find the best comparison session based on priority order
 */
export function findComparisonSession(
  currentSessionDate: Date,
  previousSessions: SessionSummaryRecord[]
): ComparisonSessionResult {
  if (previousSessions.length === 0) {
    return {
      session: null,
      timeGapHours: 0,
      priority: 0,
      insightText: "",
      metricTitle: ""
    };
  }

  // Filter out crash sessions
  const validSessions = previousSessions.filter(s => !s.is_crash);

  if (validSessions.length === 0) {
    return {
      session: null,
      timeGapHours: 0,
      priority: 0,
      insightText: "",
      metricTitle: ""
    };
  }

  // Check each priority range in order
  for (const range of PRIORITY_RANGES) {
    for (const session of validSessions) {
      const sessionDate = parseSessionDate(session);
      if (!sessionDate) continue;

      const timeGap = calculateTimeGapHours(currentSessionDate, sessionDate);

      if (timeGap >= range.min && timeGap < range.max) {
        return {
          session,
          timeGapHours: timeGap,
          priority: range.priority,
          insightText: range.insightText,
          metricTitle: range.metricTitle
        };
      }
    }
  }

  // No match found in priority ranges
  return {
    session: null,
    timeGapHours: 0,
    priority: 0,
    insightText: "",
    metricTitle: ""
  };
}

/**
 * Compare a metric value with 3ms SD floor
 */
function compareMetricWithFloor(
  current: number | null | undefined,
  previous: number | null | undefined,
  metricName: string
): 'up' | 'down' | 'stable' | null {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) {
    return null;
  }

  const absoluteChange = Math.abs(current - previous);
  const percentChange = Math.abs((current - previous) / previous) * 100; // Convert to percentage

  // Use 3ms/3 units threshold for absolute change
  // For RMSSD and SDNN, use 3ms; for wellness scores and other metrics, use 3 units
  const absoluteThreshold = (metricName === 'RMSSD' || metricName === 'SDNN') ? SD_FLOOR_MS : 3;

  // Mark as stable only if BOTH absolute change < threshold AND percentage change < 3%
  // This means: show arrows if EITHER absolute >= 3ms/3 units OR percentage >= 3%
  if (absoluteChange < absoluteThreshold && percentChange < 3) {
    return 'stable';
  }

  // Show direction for changes >= 3ms (or >= 3 units) OR >= 3% percentage change
  return current > previous ? 'up' : 'down';
}

/**
 * Compare metrics to previous session with 3ms SD floor
 */
export function compareMetricsToPrevious(
  currentSummary: SessionSummary,
  previousSummary: SessionSummaryRecord
): MetricChange[] {
  const changes: MetricChange[] = [];

  // Helper to add metric change
  // isRatio: if true, uses absolute difference scaled instead of percentage (for ratio metrics like NS Balance)
  const addChange = (
    metric: string,
    label: string,
    currentVal: number | null | undefined,
    previousVal: number | null | undefined,
    isRatio: boolean = false
  ) => {
    if (currentVal === null || currentVal === undefined || previousVal === null || previousVal === undefined) {
      return;
    }

    const absoluteChange = Math.abs(currentVal - previousVal);
    let percentChange: number;

    if (isRatio) {
      // For ratio metrics, use absolute difference scaled (e.g., 0.5 diff -> 50% display)
      percentChange = absoluteChange * 100;
    } else {
      // Standard percentage calculation
      percentChange = previousVal !== 0 ? Math.abs((currentVal - previousVal) / previousVal) * 100 : 0;
    }

    const direction = compareMetricWithFloor(currentVal, previousVal, metric);

    if (direction) {
      changes.push({
        metric,
        label,
        current: currentVal,
        previous: previousVal,
        percentChange,
        absoluteChange,
        direction
      });
    }
  };

  // 1. RMSSD
  if (currentSummary.sessionRMSSD.value !== null && previousSummary.rmssd_session_ms !== null) {
    addChange('RMSSD', 'RMSSD', currentSummary.sessionRMSSD.value, previousSummary.rmssd_session_ms);
  }

  // 2. SDNN
  if (currentSummary.sdnn?.value !== null && currentSummary.sdnn?.value !== undefined && previousSummary.sdnn_session_ms !== null) {
    addChange('SDNN', 'SDNN', currentSummary.sdnn.value, previousSummary.sdnn_session_ms);
  }

  // 3. LF Power
  if (currentSummary.lfPower.value !== null && previousSummary.lf_power_ms2 !== null) {
    addChange('LF', 'LF', currentSummary.lfPower.value, previousSummary.lf_power_ms2);
  }

  // 4. HF Power
  if (currentSummary.hfPower.value !== null && previousSummary.hf_power_ms2 !== null) {
    addChange('HF', 'HF', currentSummary.hfPower.value, previousSummary.hf_power_ms2);
  }

  // 5. LF/HF Ratio
  const currentLFHF = currentSummary.lfhfRatio ??
    (currentSummary.lfPower.value && currentSummary.hfPower.value && currentSummary.hfPower.value > 0
      ? currentSummary.lfPower.value / currentSummary.hfPower.value
      : null);
  if (currentLFHF !== null && previousSummary.lfhf_ratio !== null) {
    addChange('LF/HF', 'LF/HF', currentLFHF, previousSummary.lfhf_ratio);
  }

  // 6. AMo50
  if (currentSummary.amode50 !== null && previousSummary.amode_50 !== null) {
    addChange('AMo50', 'AMo50', currentSummary.amode50, previousSummary.amode_50);
  }

  // 7. Wellness Scores (0-100 scale, use 3 unit threshold)
  if (currentSummary.hrvScore.value !== null && previousSummary.hrv_score !== null) {
    addChange('HRV Score', 'HRV Score', currentSummary.hrvScore.value, previousSummary.hrv_score);
  }
  if (currentSummary.energyScore.value !== null && previousSummary.energy_score !== null) {
    addChange('Energy Score', 'Energy Score', currentSummary.energyScore.value, previousSummary.energy_score);
  }
  if (currentSummary.stressScore.value !== null && previousSummary.stress_score !== null) {
    addChange('Stress Score', 'Stress Score', currentSummary.stressScore.value, previousSummary.stress_score);
  }
  if (currentSummary.healthScore.value !== null && previousSummary.health_score !== null) {
    addChange('Health Score', 'Health Score', currentSummary.healthScore.value, previousSummary.health_score);
  }
  if (currentSummary.focusScore.value !== null && previousSummary.focus_score !== null) {
    addChange('Focus Score', 'Focus Score', currentSummary.focusScore.value, previousSummary.focus_score);
  }

  // 8. Nervous System Balance (SD2/SD1 ratio)
  // Use isRatio=true to calculate absolute difference scaled instead of percentage
  if (currentSummary.sd2_sd1_ratio !== null && currentSummary.sd2_sd1_ratio !== undefined && previousSummary.sd2_sd1_ratio !== null) {
    addChange('NS Balance', 'NS Balance', currentSummary.sd2_sd1_ratio, previousSummary.sd2_sd1_ratio, true);
  }

  return changes;
}

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation with 3ms floor
 */
function calculateSD(values: number[], mean: number): number {
  if (values.length === 0) return SD_FLOOR_MS;

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const sd = Math.sqrt(variance);

  // Apply 3ms floor
  return Math.max(sd, SD_FLOOR_MS);
}

/**
 * Detect if current session is a crash (-2.0 SD) relative to previous sessions
 */
export function detectCrashSession(
  currentSummary: SessionSummary,
  previousSessions: SessionSummaryRecord[]
): CrashDetectionResult {
  const currentRMSSD = currentSummary.sessionRMSSD.value;

  if (currentRMSSD === null || currentRMSSD === undefined) {
    return { isCrash: false, zScore: null };
  }

  // Filter out crash sessions and get valid RMSSD values
  const validSessions = previousSessions.filter(s => !s.is_crash && s.rmssd_session_ms !== null);

  if (validSessions.length === 0) {
    return { isCrash: false, zScore: null };
  }

  const rmssdValues = validSessions.map(s => s.rmssd_session_ms!).filter(v => v > 0);

  if (rmssdValues.length === 0) {
    return { isCrash: false, zScore: null };
  }

  // Calculate mean and SD with floor
  const mean = calculateMean(rmssdValues);
  const sd = calculateSD(rmssdValues, mean);

  // Calculate Z-score
  const zScore = (currentRMSSD - mean) / sd;

  // Check if crash (Z < -2.0)
  const isCrash = zScore < -2.0;

  return { isCrash, zScore };
}

/**
 * Generate score-based interpretation for first session or <4h gap
 * Note: Scores are already displayed visually in WellnessScoreGrid, so we provide simple guidance instead
 */
export function generateScoreBasedInterpretation(
  currentSummary: SessionSummary,
  isFirstSession: boolean = false
): InterpretationResult {
  const scores = {
    hrv: currentSummary.hrvScore.value,
    energy: currentSummary.energyScore.value,
    stress: currentSummary.stressScore.value,
    health: currentSummary.healthScore.value,
    focus: currentSummary.focusScore.value
  };

  // Build simple interpretation text (scores are displayed visually above)
  // For score-based sessions, we return empty string since scores are already displayed visually
  const relativeInterpretation: string = "";

  // Generate advice based on scores
  const adviceParts: string[] = [];

  if (scores.hrv !== null && scores.hrv !== undefined && scores.hrv < 50) {
    adviceParts.push("Your HRV Score suggests room for recovery. Focus on rest, quality sleep, and stress management.");
  } else if (scores.hrv !== null && scores.hrv !== undefined && scores.hrv >= 70) {
    adviceParts.push("Your HRV Score indicates strong recovery. This is a good time for optimal performance.");
  }

  if (scores.stress !== null && scores.stress !== undefined && scores.stress > 60) {
    adviceParts.push("Your Stress Score is elevated. Consider relaxation techniques, breathing exercises, or reducing stressors.");
  }

  if (scores.energy !== null && scores.energy !== undefined && scores.energy < 50) {
    adviceParts.push("Your Energy Score is below average. Ensure adequate rest and nutrition to support recovery.");
  }

  const combinedAdvice = adviceParts.length > 0
    ? adviceParts.join(' ')
    : "Continue tracking your sessions to build a comprehensive picture of your HRV patterns.";

  return {
    patternId: 0, // No pattern for calibration phase
    physiologicalState: isFirstSession ? "First Session" : "Calibration Phase",
    coreInterpretation: "Analyzing your initial HRV metrics using score-based assessment.",
    recommendedAction: "Continue tracking to establish your personalized baseline.",
    technicalChanges: [],
    relativeInterpretation,
    combinedAdvice,
    baselineDetails: undefined, // No baseline details needed since scores are displayed visually
    title: isFirstSession ? "HRV Summary" : "HRV Analysis"
  };
}

/**
 * Generate calibration phase interpretation with metric comparison
 */
export function generateCalibrationInterpretation(
  currentSummary: SessionSummary,
  previousSummary: SessionSummaryRecord,
  insightText: string,
  title?: string
): InterpretationResult {
  const metricChanges = compareMetricsToPrevious(currentSummary, previousSummary);

  // Filter to most significant changes (>5% or marked as up/down)
  const significantChanges = metricChanges.filter(m =>
    m.direction !== 'stable' || m.percentChange > 5
  ).slice(0, 4); // Limit to 4 most significant

  // Build interpretation text
  const changeDescriptions: string[] = [];

  for (const change of significantChanges) {
    if (change.direction === 'stable') {
      changeDescriptions.push(`${change.label} is stable`);
    } else {
      const direction = change.direction === 'up' ? 'up' : 'down';
      changeDescriptions.push(`${change.label} is ${direction} ${change.percentChange.toFixed(1)}%`);
    }
  }

  const relativeInterpretation = changeDescriptions.length > 0
    ? `${insightText}, ${changeDescriptions.join(', ')}.`
    : `${insightText}, your metrics are relatively stable.`;

  // Generate baseline details for UI
  const baselineDetails: InterpretationResult['baselineDetails'] = metricChanges.map(change => ({
    metric: change.metric,
    label: change.label,
    current: change.current,
    baseline: change.previous,
    percentChange: change.percentChange,
    direction: change.direction
  }));

  // Generate advice based on changes
  const adviceParts: string[] = [];

  const rmssdChange = metricChanges.find(m => m.metric === 'RMSSD');
  if (rmssdChange && rmssdChange.direction === 'down' && rmssdChange.percentChange > 10) {
    adviceParts.push("Your RMSSD has decreased significantly, suggesting reduced recovery. Focus on rest and stress management.");
  } else if (rmssdChange && rmssdChange.direction === 'up' && rmssdChange.percentChange > 10) {
    adviceParts.push("Your RMSSD has improved, indicating better recovery. Maintain your current routine.");
  }

  const stressChange = metricChanges.find(m => m.metric === 'AMo50');
  if (stressChange && stressChange.direction === 'up' && stressChange.percentChange > 10) {
    adviceParts.push("Your stress levels appear elevated. Consider relaxation techniques and ensure adequate recovery.");
  }

  const combinedAdvice = adviceParts.length > 0
    ? adviceParts.join(' ')
    : "Continue tracking to build your baseline. Consistency is key to understanding your HRV patterns.";

  return {
    patternId: 0, // No pattern for calibration phase
    physiologicalState: "Calibration Phase",
    coreInterpretation: "Comparing your current session to previous measurements during the calibration period.",
    recommendedAction: "Continue tracking to establish your personalized baseline.",
    technicalChanges: [],
    relativeInterpretation,
    combinedAdvice,
    baselineDetails: baselineDetails.length > 0 ? baselineDetails : undefined,
    title: title || "HRV Changes Since Last Session"
  };
}

