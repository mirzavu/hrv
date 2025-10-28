/**
 * Auto-baseline check utility
 * Automatically checks and establishes/updates user baseline after each session
 */

import { getAdminPb } from '@/lib/pbAdmin';
import { calculateBaselineMetrics, hasValidTemporalDistribution } from './baselineCalculations';

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

    // Fetch user's most recent 14 sessions
    const sessions = await pb.collection('sessions').getList(1, 14, {
      filter: `userId = "${userId}"`,
      sort: '-startTime'
    });

    if (sessions.items.length < 7) {
      return {
        success: true,
        action: 'insufficient_sessions',
        message: `Need ${7 - sessions.items.length} more sessions`,
        baselineEstablished: false,
        sessionsUsed: sessions.items.length
      };
    }

    // Fetch session summaries
    const sessionIds = sessions.items.map(s => s.id);
    const summaryPromises = sessionIds.map(id =>
      pb.collection('session_summary').getFirstListItem(`session_id = "${id}"`)
        .catch(() => null)
    );

    const summaries = (await Promise.all(summaryPromises))
      .filter((s): s is any => s !== null);

    if (summaries.length < 7) {
      return {
        success: true,
        action: 'insufficient_sessions',
        message: `Need ${7 - summaries.length} more sessions with complete data`,
        baselineEstablished: false,
        sessionsUsed: summaries.length
      };
    }

    // Check temporal distribution
    const temporalCheck = hasValidTemporalDistribution(summaries);
    if (!temporalCheck.valid) {
      return {
        success: true,
        action: 'insufficient_days',
        message: `Sessions must span at least 5 days across 5 unique dates`,
        baselineEstablished: false,
        sessionsUsed: summaries.length,
        uniqueDays: temporalCheck.uniqueDays
      };
    }

    // Calculate baseline metrics
    const baselineMetrics = calculateBaselineMetrics(summaries);

    if (baselineMetrics.rmssd_avg === null) {
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
    } catch (error: any) {
      // 404 is expected if no baseline exists yet
      if (error.status !== 404) {
        throw error;
      }
    }

    let action: 'created' | 'updated' = 'created';

    if (existingBaseline) {
      // Update existing baseline
      await pb.collection('user_baselines').update(existingBaseline.id, {
        ...baselineMetrics,
        sessions_count: summaries.length,
        established: true,
        last_updated: currentTime
      });
      action = 'updated';
    } else {
      // Create new baseline
      await pb.collection('user_baselines').create({
        user_id: userId,
        ...baselineMetrics,
        sessions_count: summaries.length,
        established: true,
        last_updated: currentTime
      });
      action = 'created';
    }

    return {
      success: true,
      action,
      message: action === 'created' 
        ? 'Personal baseline established successfully' 
        : 'Baseline updated with new session data',
      baselineEstablished: true,
      sessionsUsed: summaries.length,
      uniqueDays: temporalCheck.uniqueDays
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
    const sessions = await pb.collection('sessions').getList(1, 14, {
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
    const temporalCheck = hasValidTemporalDistribution(summaries);

    const sessionsNeeded = Math.max(0, 7 - currentSessions);
    const daysNeeded = temporalCheck.valid ? 0 : Math.max(0, 5 - temporalCheck.uniqueDays);

    let message = '';
    if (sessionsNeeded > 0) {
      message = `Record ${sessionsNeeded} more session${sessionsNeeded > 1 ? 's' : ''} to establish baseline`;
    } else if (daysNeeded > 0) {
      message = `Sessions must span ${daysNeeded} more unique day${daysNeeded > 1 ? 's' : ''}`;
    } else {
      message = 'Baseline will be established after this session';
    }

    return {
      hasBaseline: false,
      sessionsNeeded,
      daysNeeded,
      currentSessions,
      currentDays: temporalCheck.uniqueDays,
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

