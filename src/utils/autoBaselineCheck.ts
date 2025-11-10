/**
 * Auto-baseline check utility
 * Automatically checks and establishes/updates user baseline after each session
 */

import { getAdminPb } from '@/lib/pbAdmin';
import { calculateBaselineMetrics, canCreateBaseline, selectSessionsForBaseline } from './baselineCalculations';

/**
 * Automatically check if user baseline can be established or updated
 * Called after each session is completed and analyzed
 * 
 * @param userId - User ID to check baseline for
 * @returns Result object with status and details
 */
export const autoCheckAndUpdateBaseline = async (
  userId: string
): Promise<{
  success: boolean;
  action: 'created' | 'updated' | 'skipped' | 'insufficient_sessions' | 'insufficient_days';
  message: string;
  baselineEstablished: boolean;
  sessionsUsed?: number;
  uniqueDays?: number;
}> => {
  try {
    const pb = await getAdminPb();

    // Fetch user's sessions - get enough to check last 14 days
    const sessions = await pb.collection('sessions').getList(1, 200, {
      filter: `userId = "${userId}"`,
      sort: '-startTime'
    });

    console.log(`[BASELINE_DEBUG] Fetched ${sessions.items.length} sessions for user ${userId}`);

    if (sessions.items.length === 0) {
      console.log(`[BASELINE_DEBUG] No sessions found`);
      return {
        success: true,
        action: 'insufficient_sessions',
        message: `Need at least 1 session to establish baseline`,
        baselineEstablished: false,
        sessionsUsed: 0
      };
    }

    // Fetch session summaries for all sessions
    const sessionIds = sessions.items.map(s => s.id);
    const summaryPromises = sessionIds.map(id =>
      pb.collection('session_summary').getFirstListItem(`session_id = "${id}"`)
        .catch(() => null)
    );

    const allSummaries = (await Promise.all(summaryPromises))
      .filter((s): s is any => s !== null);

    console.log(`[BASELINE_DEBUG] Found ${allSummaries.length} summaries with data`);

    if (allSummaries.length === 0) {
      console.log(`[BASELINE_DEBUG] No summaries found`);
      return {
        success: true,
        action: 'insufficient_sessions',
        message: `Need sessions with complete data to establish baseline`,
        baselineEstablished: false,
        sessionsUsed: 0
      };
    }

    // Check if user can create baseline (at least 5 unique days in last 14 days)
    const baselineCheck = canCreateBaseline(allSummaries);
    console.log(`[BASELINE_DEBUG] Baseline check: valid=${baselineCheck.valid}, uniqueDays=${baselineCheck.uniqueDays} (in last 14 days)`);
    
    if (!baselineCheck.valid) {
      console.log(`[BASELINE_DEBUG] Cannot create baseline - need at least 5 unique days in last 14 days`);
      return {
        success: true,
        action: 'insufficient_days',
        message: `Need sessions on at least 5 different days in the last 14 days. Current: ${baselineCheck.uniqueDays} days`,
        baselineEstablished: false,
        sessionsUsed: allSummaries.length,
        uniqueDays: baselineCheck.uniqueDays
      };
    }

    // Select sessions for baseline: latest 7 dates, up to 2 sessions per date (max 14, min 5)
    const summaries = selectSessionsForBaseline(allSummaries);
    console.log(`[BASELINE_DEBUG] Selected ${summaries.length} sessions for baseline calculation`);

    if (summaries.length < 5) {
      console.log(`[BASELINE_DEBUG] Not enough sessions selected: ${summaries.length} < 5`);
      return {
        success: true,
        action: 'insufficient_sessions',
        message: `Need at least 5 sessions to establish baseline`,
        baselineEstablished: false,
        sessionsUsed: summaries.length
      };
    }

    // Calculate baseline metrics
    console.log(`[BASELINE_DEBUG] Calculating baseline metrics from ${summaries.length} summaries`);
    const baselineMetrics = calculateBaselineMetrics(summaries);
    console.log(`[BASELINE_DEBUG] Baseline metrics calculated:`, {
      rmssd_avg: baselineMetrics.rmssd_avg,
      sdnn_avg: baselineMetrics.sdnn_avg,
      hr_avg: baselineMetrics.hr_avg
    });

    if (baselineMetrics.rmssd_avg === null) {
      console.log(`[BASELINE_DEBUG] Cannot calculate baseline - insufficient valid data`);
      return {
        success: false,
        action: 'skipped',
        message: 'Insufficient valid data to calculate baseline',
        baselineEstablished: false,
        sessionsUsed: summaries.length
      };
    }

    const currentTime = new Date().toISOString();

    // Check if baseline already exists
    let existingBaseline: any = null;
    try {
      existingBaseline = await pb.collection('user_baselines').getFirstListItem(
        `user_id = "${userId}"`
      );
      console.log(`[BASELINE_DEBUG] Existing baseline found: ${existingBaseline.id}`);
    } catch (error: any) {
      // 404 is expected if no baseline exists yet
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[BASELINE_DEBUG] No existing baseline found - will create new one`);
    }

    let action: 'created' | 'updated' = 'created';

    if (existingBaseline) {
      // Update existing baseline
      console.log(`[BASELINE_DEBUG] Updating existing baseline ${existingBaseline.id}`);
      await pb.collection('user_baselines').update(existingBaseline.id, {
        ...baselineMetrics,
        sessions_count: summaries.length,
        established: true,
        last_updated: currentTime
      });
      action = 'updated';
      console.log(`[BASELINE_DEBUG] Baseline updated successfully`);
    } else {
      // Create new baseline
      console.log(`[BASELINE_DEBUG] Creating new baseline for user ${userId}`);
      const newBaseline = await pb.collection('user_baselines').create({
        user_id: userId,
        ...baselineMetrics,
        sessions_count: summaries.length,
        established: true,
        last_updated: currentTime
      });
      action = 'created';
      console.log(`[BASELINE_DEBUG] Baseline created successfully: ${newBaseline.id}`);
    }

    return {
      success: true,
      action,
      message: action === 'created' 
        ? 'Personal baseline established successfully' 
        : 'Baseline updated with new session data',
      baselineEstablished: true,
      sessionsUsed: summaries.length,
      uniqueDays: baselineCheck.uniqueDays
    };

  } catch (error) {
    console.error('Error in auto baseline check:', error);
    return {
      success: false,
      action: 'skipped',
      message: 'Error checking baseline',
      baselineEstablished: false
    };
  }
};

/**
 * Get baseline status for display in UI
 * 
 * @param userId - User ID to check
 * @returns Status object for UI display
 */
export const getBaselineStatus = async (
  userId: string
): Promise<{
  hasBaseline: boolean;
  sessionsNeeded: number;
  daysNeeded: number;
  currentSessions: number;
  currentDays: number;
  message: string;
}> => {
  try {
    const pb = await getAdminPb();

    // Check if baseline exists
    let hasBaseline = false;
    try {
      const baseline = await pb.collection('user_baselines').getFirstListItem(
        `user_id = "${userId}"`
      );
      if (baseline.established) {
        hasBaseline = true;
      }
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
    }

    if (hasBaseline) {
      return {
        hasBaseline: true,
        sessionsNeeded: 0,
        daysNeeded: 0,
        currentSessions: 0,
        currentDays: 0,
        message: 'Baseline established'
      };
    }

    // Fetch recent sessions to check progress
    const sessions = await pb.collection('sessions').getList(1, 200, {
      filter: `userId = "${userId}"`,
      sort: '-startTime'
    });

    const sessionIds = sessions.items.map(s => s.id);
    const summaryPromises = sessionIds.map(id =>
      pb.collection('session_summary').getFirstListItem(`session_id = "${id}"`)
        .catch(() => null)
    );

    const summaries = (await Promise.all(summaryPromises))
      .filter((s): s is any => s !== null);

    const currentSessions = summaries.length;
    const baselineCheck = canCreateBaseline(summaries);
    const selectedSessions = selectSessionsForBaseline(summaries);

    const daysNeeded = baselineCheck.valid ? 0 : Math.max(0, 5 - baselineCheck.uniqueDays);
    const sessionsNeeded = selectedSessions.length < 5 ? Math.max(0, 5 - selectedSessions.length) : 0;

    let message = '';
    if (daysNeeded > 0) {
      message = `Need sessions on ${daysNeeded} more unique day${daysNeeded > 1 ? 's' : ''} in the last 14 days`;
    } else if (sessionsNeeded > 0) {
      message = `Need ${sessionsNeeded} more session${sessionsNeeded > 1 ? 's' : ''} to establish baseline`;
    } else {
      message = 'Baseline will be established after this session';
    }

    return {
      hasBaseline: false,
      sessionsNeeded,
      daysNeeded,
      currentSessions: selectedSessions.length,
      currentDays: baselineCheck.uniqueDays,
      message
    };

  } catch (error) {
    console.error('Error getting baseline status:', error);
    return {
      hasBaseline: false,
      sessionsNeeded: 7,
      daysNeeded: 5,
      currentSessions: 0,
      currentDays: 0,
      message: 'Error checking baseline status'
    };
  }
};

