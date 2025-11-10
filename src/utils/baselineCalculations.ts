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
} => {
  // Filter out sessions with missing critical metrics
  const validSessions = sessions.filter(s => 
    s.rmssd_session_ms !== null && 
    s.sdnn_session_ms !== null && 
    s.session_mean_hr !== null
  );

  if (validSessions.length < 7) {
    // Not enough sessions to establish baseline
    return {
      rmssd_avg: null,
      rmssd_stdev: null,
      sdnn_avg: null,
      sdnn_stdev: null,
      hr_avg: null,
      hr_stdev: null,
      sd1_sd2_ratio_avg: null,
      sd1_sd2_ratio_stdev: null,
    };
  }

  // Extract RMSSD values
  const rmssdValues = validSessions
    .map(s => s.rmssd_session_ms)
    .filter((v): v is number => v !== null);
  const rmssd_avg = calculateMean(rmssdValues);
  const rmssd_stdev = calculateStdev(rmssdValues, rmssd_avg);

  // Extract SDNN values
  const sdnnValues = validSessions
    .map(s => s.sdnn_session_ms)
    .filter((v): v is number => v !== null);
  const sdnn_avg = calculateMean(sdnnValues);
  const sdnn_stdev = calculateStdev(sdnnValues, sdnn_avg);

  // Extract HR values
  const hrValues = validSessions
    .map(s => s.session_mean_hr)
    .filter((v): v is number => v !== null);
  const hr_avg = calculateMean(hrValues);
  const hr_stdev = calculateStdev(hrValues, hr_avg);

  // Extract SD1/SD2 ratio values (optional)
  const sd1Sd2Values = validSessions
    .filter(s => s.sd1_ms !== null && s.sd2_ms !== null && s.sd1_ms! > 0 && s.sd2_ms! > 0)
    .map(s => s.sd1_ms! / s.sd2_ms!);
  
  const sd1_sd2_ratio_avg = sd1Sd2Values.length >= 7 
    ? calculateMean(sd1Sd2Values) 
    : null;
  const sd1_sd2_ratio_stdev = sd1Sd2Values.length >= 7 
    ? calculateStdev(sd1Sd2Values, sd1_sd2_ratio_avg!) 
    : null;

  return {
    rmssd_avg: Number(rmssd_avg.toFixed(2)),
    rmssd_stdev: Number(rmssd_stdev.toFixed(2)),
    sdnn_avg: Number(sdnn_avg.toFixed(2)),
    sdnn_stdev: Number(sdnn_stdev.toFixed(2)),
    hr_avg: Number(hr_avg.toFixed(2)),
    hr_stdev: Number(hr_stdev.toFixed(2)),
    sd1_sd2_ratio_avg: sd1_sd2_ratio_avg !== null ? Number(sd1_sd2_ratio_avg.toFixed(4)) : null,
    sd1_sd2_ratio_stdev: sd1_sd2_ratio_stdev !== null ? Number(sd1_sd2_ratio_stdev.toFixed(4)) : null,
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
  if (
    sessionMetrics.rmssd === null || 
    sessionMetrics.sdnn === null || 
    sessionMetrics.meanHR === null
  ) {
    return null;
  }

  // Check if we have required baseline metrics
  if (
    baseline.rmssd_avg === null || 
    baseline.rmssd_stdev === null ||
    baseline.sdnn_avg === null || 
    baseline.sdnn_stdev === null ||
    baseline.hr_avg === null || 
    baseline.hr_stdev === null
  ) {
    return null;
  }

  try {
    // Calculate normalized z-scores for each metric
    // p_RMSSD: Parasympathetic activity indicator
    const p_RMSSD = baseline.rmssd_stdev > 0
      ? (sessionMetrics.rmssd - baseline.rmssd_avg) / baseline.rmssd_stdev
      : 0;

    // p_SDNN: Overall autonomic variability
    const p_SDNN = baseline.sdnn_stdev > 0
      ? (sessionMetrics.sdnn - baseline.sdnn_avg) / baseline.sdnn_stdev
      : 0;

    // p_HR: Heart rate (inverted - higher HR reduces score)
    const p_HR = baseline.hr_stdev > 0
      ? (sessionMetrics.meanHR - baseline.hr_avg) / baseline.hr_stdev
      : 0;

    // Calculate weighted HRV Readiness Score
    // Formula: (0.35 * p_RMSSD) + (0.35 * p_SDNN) - (0.30 * p_HR)
    const readinessRaw = (0.35 * p_RMSSD) + (0.35 * p_SDNN) - (0.30 * p_HR);

    // Convert z-score to 0-100 scale
    // Z-score of 0 (average) = 50
    // Z-score of +2 (2 std above) = 100
    // Z-score of -2 (2 std below) = 0
    const readinessScore = 50 + (readinessRaw * 25);

    // Clamp to 0-100 range
    const clampedScore = Math.max(0, Math.min(100, readinessScore));

    return Number(clampedScore.toFixed(1));

  } catch (error) {
    console.error('Error calculating HRV readiness score:', error);
    return null;
  }
};

/**
 * Interpret the HRV Readiness Score
 * 
 * @param score - HRV Readiness Score (0-100)
 * @returns Interpretation object with status and message
 */
export const interpretReadinessScore = (score: number | null): {
  status: 'excellent' | 'good' | 'average' | 'below-average' | 'poor' | 'no-baseline';
  message: string;
  color: string;
} => {
  if (score === null) {
    return {
      status: 'no-baseline',
      message: 'Complete 7-14 consistent resting sessions to establish your personal baseline',
      color: '#6B7280' // gray
    };
  }

  if (score >= 70) {
    return {
      status: 'excellent',
      message: 'Your recovery is significantly above your baseline. High readiness.',
      color: '#10B981' // green
    };
  } else if (score >= 55) {
    return {
      status: 'good',
      message: 'Your recovery is above your baseline. Good readiness.',
      color: '#34D399' // light green
    };
  } else if (score >= 45) {
    return {
      status: 'average',
      message: 'Your recovery is within your normal range.',
      color: '#F59E0B' // amber
    };
  } else if (score >= 30) {
    return {
      status: 'below-average',
      message: 'Your recovery is below your baseline. Consider rest or recovery.',
      color: '#F97316' // orange
    };
  } else {
    return {
      status: 'poor',
      message: 'Your recovery is significantly below baseline. Prioritize recovery.',
      color: '#EF4444' // red
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
  return sessionsCount >= 7;
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
const groupSessionsByDate = (
  sessions: Array<{ session_date?: string; createdAt?: string; created?: string; [key: string]: any }>
): Map<string, typeof sessions> => {
  console.log(`[BASELINE_CALC] groupSessionsByDate: Processing ${sessions.length} sessions`);
  const grouped = new Map<string, typeof sessions>();
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
 * Condition: At least 5 unique days with sessions in the last 14 days
 * 
 * @param sessions - Array of session summary records
 * @returns Validation result
 */
export const canCreateBaseline = (
  sessions: Array<{ session_date?: string; createdAt?: string; created?: string; [key: string]: any }>
): { valid: boolean; uniqueDays: number } => {
  console.log(`[BASELINE_CALC] canCreateBaseline: Checking ${sessions.length} sessions`);
  
  if (sessions.length === 0) {
    console.log(`[BASELINE_CALC] canCreateBaseline: No sessions provided - INVALID`);
    return { valid: false, uniqueDays: 0 };
  }

  const grouped = groupSessionsByDate(sessions);
  
  // Get current date and calculate 14 days ago
  const now = new Date();
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  
  console.log(`[BASELINE_CALC] canCreateBaseline: Checking last 14 days from ${fourteenDaysAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);
  
  // Filter to sessions from last 14 days
  const allDates = Array.from(grouped.keys());
  const recentDates = allDates.filter(dateStr => {
    const date = new Date(dateStr);
    const isRecent = date >= fourteenDaysAgo;
    if (!isRecent) {
      console.log(`[BASELINE_CALC] canCreateBaseline: Date ${dateStr} is outside 14-day window`);
    }
    return isRecent;
  });
  
  const uniqueDays = recentDates.length;
  const MIN_UNIQUE_DAYS = 5;
  
  console.log(`[BASELINE_CALC] canCreateBaseline: Found ${uniqueDays} unique days in last 14 days (need ${MIN_UNIQUE_DAYS})`);
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
export const selectSessionsForBaseline = (
  sessions: Array<{ session_date?: string; createdAt?: string; created?: string; [key: string]: any }>
): typeof sessions => {
  console.log(`[BASELINE_CALC] selectSessionsForBaseline: Selecting from ${sessions.length} sessions`);
  
  if (sessions.length === 0) {
    console.log(`[BASELINE_CALC] selectSessionsForBaseline: No sessions to select - returning empty array`);
    return [];
  }

  const grouped = groupSessionsByDate(sessions);
  
  // Sort dates descending (most recent first)
  const sortedDates = Array.from(grouped.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });
  
  console.log(`[BASELINE_CALC] selectSessionsForBaseline: All dates sorted:`, sortedDates.join(', '));
  
  // Get latest 7 dates
  const latest7Dates = sortedDates.slice(0, 7);
  console.log(`[BASELINE_CALC] selectSessionsForBaseline: Latest 7 dates:`, latest7Dates.join(', '));
  
  // For each date, take up to 2 most recent sessions
  const selected: typeof sessions = [];
  const selectionLog: string[] = [];
  
  for (const date of latest7Dates) {
    const dateSessions = grouped.get(date) || [];
    console.log(`[BASELINE_CALC] selectSessionsForBaseline: Date ${date} has ${dateSessions.length} sessions`);
    
    // Sort sessions by date descending (most recent first)
    const sortedSessions = dateSessions.sort((a, b) => {
      const dateA = new Date(a.session_date || a.created || a.createdAt || 0).getTime();
      const dateB = new Date(b.session_date || b.created || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    
    // Take up to 2 sessions from this date
    const taken = sortedSessions.slice(0, 2);
    selected.push(...taken);
    selectionLog.push(`${date}: ${taken.length} session(s) (${dateSessions.length} available)`);
    console.log(`[BASELINE_CALC] selectSessionsForBaseline: Selected ${taken.length} from ${date} (${dateSessions.length} total)`);
  }
  
  console.log(`[BASELINE_CALC] selectSessionsForBaseline: After initial selection: ${selected.length} sessions`);
  console.log(`[BASELINE_CALC] selectSessionsForBaseline: Selection breakdown:`, selectionLog.join('; '));
  
  // Ensure we have at least 5 sessions (if available)
  if (selected.length < 5 && sessions.length >= 5) {
    console.log(`[BASELINE_CALC] selectSessionsForBaseline: Only ${selected.length} sessions selected, need at least 5. Fetching more...`);
    
    // If we don't have enough, take more from the latest dates
    for (const date of latest7Dates) {
      const dateSessions = grouped.get(date) || [];
      const sortedSessions = dateSessions.sort((a, b) => {
        const dateA = new Date(a.session_date || a.created || a.createdAt || 0).getTime();
        const dateB = new Date(b.session_date || b.created || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      
      // Add sessions we haven't already added
      let addedFromDate = 0;
      for (const session of sortedSessions) {
        if (selected.length >= 14) break;
        if (!selected.includes(session)) {
          selected.push(session);
          addedFromDate++;
        }
      }
      if (addedFromDate > 0) {
        console.log(`[BASELINE_CALC] selectSessionsForBaseline: Added ${addedFromDate} more from ${date}`);
      }
      if (selected.length >= 14) break;
    }
  }
  
  const finalSelection = selected.slice(0, 14); // Max 14 sessions
  console.log(`[BASELINE_CALC] selectSessionsForBaseline: Final selection: ${finalSelection.length} sessions (min: 5, max: 14)`);
  
  if (finalSelection.length < 5) {
    console.log(`[BASELINE_CALC] selectSessionsForBaseline: WARNING - Only ${finalSelection.length} sessions selected (need at least 5)`);
  }
  
  return finalSelection;
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

