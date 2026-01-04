/**
 * Auto-baseline check utility
 * Automatically checks and establishes/updates user baseline after each session
 */

import { getAdminPb } from '@/lib/pbAdmin';
import { calculateBaselineMetrics, canCreateBaseline, selectSessionsForBaseline, countUniqueMorningSessions, calculateBaselineProgress } from './baselineCalculations';

/**
 * Check if user has any session for today (UTC date), excluding the current session
 * 
 * @param userId - User ID to check
 * @param currentSessionId - Current session ID to exclude from check
 * @returns true if at least one other session exists for today
 */
const hasSessionToday = async (userId: string, currentSessionId: string): Promise<boolean> => {
  try {
    const pb = await getAdminPb();

    // Get today's date range in UTC (start and end of day)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const todayStartISO = todayStart.toISOString();
    const todayEndISO = todayEnd.toISOString();

    // Check if any OTHER session exists for today (excluding current session)
    const sessions = await pb.collection('sessions').getList(1, 1, {
      filter: `userId = "${userId}" && startTime >= "${todayStartISO}" && startTime <= "${todayEndISO}" && id != "${currentSessionId}"`
    });

    return sessions.items.length > 0;
  } catch (error) {
    console.error('[BASELINE_DEBUG] Error checking for today\'s session:', error);
    // If check fails, allow baseline update to proceed (fail open)
    return false;
  }
};

/**
 * Automatically check if user baseline can be established or updated
 * Called after each session is completed and analyzed
 * Only runs once per day (after first valid session of the day)
 * 
 * @param userId - User ID to check baseline for
 * @param currentSessionId - Current session ID (to exclude from today's check)
 * @returns Result object with phase data and baseline status
 */
export const autoCheckAndUpdateBaseline = async (
  userId: string,
  currentSessionId?: string,
  currentSessionSummary?: { session_date?: string | null; rmssd_session_ms?: number | null }
): Promise<{
  success: boolean;
  phase: 'calibration' | 'early_baseline' | 'full_baseline';
  phaseProgress: number; // 0-100
  uniqueDays: number;
  isFirstSession?: boolean;
  baselineCreated?: boolean;
  baselineUpdated?: boolean;
}> => {
  console.log(`[BASELINE] Called with params:`, {
    userId,
    currentSessionId: currentSessionId || 'none',
    currentSessionSummary: currentSessionSummary ? {
      session_date: currentSessionSummary.session_date,
      rmssd_session_ms: currentSessionSummary.rmssd_session_ms
    } : 'none'
  });

  try {
    const pb = await getAdminPb();
    console.log(`[BASELINE] Starting baseline check for user ${userId}, sessionId: ${currentSessionId || 'none'}`);

    // Step 0: Check if there's already another session for today - if so, skip baseline update (once per day)
    if (currentSessionId) {
      const hasTodaySession = await hasSessionToday(userId, currentSessionId);
      if (hasTodaySession) {
        console.log(`[BASELINE] Step 0: Another session exists today - skipping baseline update (once per day)`);
        // Fetch current phase from user profile and calculate unique days
        try {
          const userRecord = await pb.collection('users').getOne(userId);
          const currentPhase = userRecord.usage_phase || 'calibration';

          // Fetch sessions to calculate unique days
          const sessions = await pb.collection('sessions').getList(1, 200, {
            filter: `userId = "${userId}"`,
            sort: '-startTime'
          });

          const sessionIds = sessions.items.map(s => s.id);
          const summaryPromises = sessionIds.map(id =>
            pb.collection('session_summary').getFirstListItem(`session_id = "${id}"`)
              .catch(() => null)
          );

          const allSummaries = (await Promise.all(summaryPromises))
            .filter((s): s is any => s !== null);

          const uniqueCount = countUniqueMorningSessions(allSummaries);
          const progressInfo = calculateBaselineProgress(uniqueCount);

          console.log(`[BASELINE] Step 0: Returning current phase: ${currentPhase}, uniqueDays: ${uniqueCount}, progress: ${progressInfo.progress}%`);

          return {
            success: true,
            phase: currentPhase as 'calibration' | 'early_baseline' | 'full_baseline',
            phaseProgress: progressInfo.progress,
            uniqueDays: uniqueCount
          };
        } catch {
          const result = {
            success: true,
            phase: 'calibration' as const,
            phaseProgress: 0,
            uniqueDays: 0
          };
          console.log(`[BASELINE] Step 0: Error fetching user data, returning:`, result);
          return result;
        }
      }
    }

    // Fetch all session summaries
    const sessions = await pb.collection('sessions').getList(1, 200, {
      filter: `userId = "${userId}"`,
      sort: '-startTime'
    });

    // Fetch session summaries for all sessions
    const sessionIds = sessions.items.map(s => s.id);
    const summaryPromises = sessionIds.map(id =>
      pb.collection('session_summary').getFirstListItem(`session_id = "${id}"`)
        .catch(() => null)
    );

    let allSummaries = (await Promise.all(summaryPromises))
      .filter((s): s is any => s !== null);

    // Include current session summary if provided (it's not saved to DB yet)
    if (currentSessionSummary && currentSessionId) {
      // Check if current session is already in the list (shouldn't be, but check)
      const currentExists = allSummaries.some(s => s.session_id === currentSessionId);
      if (!currentExists) {
        allSummaries = [
          {
            ...currentSessionSummary,
            session_id: currentSessionId
          },
          ...allSummaries
        ];
        console.log(`[BASELINE] Included current session summary in count (not yet saved to DB)`);
      }
    }

    if (allSummaries.length === 0) {
      const result = {
        success: true,
        phase: 'calibration' as const,
        phaseProgress: 0,
        uniqueDays: 0,
        isFirstSession: true
      };
      console.log(`[BASELINE] No session summaries found, returning:`, result);
      return result;
    }

    // Detect if this is the user's first session ever
    const isFirstSession = allSummaries.length === 1;

    // Step 1: Get unique day count (including current session)
    const uniqueDays = countUniqueMorningSessions(allSummaries);
    const progressInfo = calculateBaselineProgress(uniqueDays);
    const currentTime = new Date().toISOString();
    console.log(`[BASELINE] Step 1: Calculated uniqueDays: ${uniqueDays}, phase: ${progressInfo.phase}, progress: ${progressInfo.progress}%`);

    // Check if baseline exists
    let existingBaseline: any = null;
    try {
      existingBaseline = await pb.collection('user_baselines').getFirstListItem(
        `user_id = "${userId}"`
      );
      console.log(`[BASELINE] Step 1: Baseline exists: ${existingBaseline.id}`);
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
      console.log(`[BASELINE] Step 1: No baseline found`);
    }

    // Step 2: If < 4: Save usage_phase as "calibration", return phase data
    if (uniqueDays < 4) {
      console.log(`[BASELINE] Step 2: uniqueDays (${uniqueDays}) < 4 - Setting phase to 'calibration'`);
      try {
        await pb.collection('users').update(userId, {
          usage_phase: 'calibration'
        });
        console.log(`[BASELINE] Step 2: Updated usage_phase to 'calibration'`);
      } catch (error: any) {
        console.error('[BASELINE] Failed to update usage_phase:', error);
      }

      const result = {
        success: true,
        phase: 'calibration' as const,
        phaseProgress: progressInfo.progress,
        uniqueDays,
        isFirstSession
      };
      console.log(`[BASELINE] Step 2: Returning:`, result);
      return result;
    }

    // Step 5: If > 14: Update phase to "full_baseline", return phase data (check before step 3/4)
    if (uniqueDays > 14) {
      console.log(`[BASELINE] Step 5: uniqueDays (${uniqueDays}) > 14 - Setting phase to 'full_baseline'`);
      const fullBaselinePhase: 'full_baseline' = 'full_baseline';

      try {
        await pb.collection('users').update(userId, {
          usage_phase: fullBaselinePhase
        });
        console.log(`[BASELINE] Step 5: Updated usage_phase to 'full_baseline'`);
      } catch (error: any) {
        console.error('[BASELINE] Failed to update usage_phase:', error);
      }

      // Update baseline if it exists
      if (existingBaseline) {
        console.log(`[BASELINE] Step 5: Updating existing baseline`);
        try {
          const summaries = selectSessionsForBaseline(allSummaries);
          if (summaries.length >= 4) {
            const baselineMetrics = calculateBaselineMetrics(summaries);
            await pb.collection('user_baselines').update(existingBaseline.id, {
              ...baselineMetrics,
              sessions_count: summaries.length,
              unique_morning_sessions_count: uniqueDays,
              calibration_progress: 100,
              last_updated: currentTime
            });
            console.log(`[BASELINE] Step 5: Baseline updated with ${summaries.length} sessions`);
          }
        } catch (error: any) {
          console.error('[BASELINE] Failed to update baseline:', error);
        }
      } else {
        // Create baseline if it doesn't exist (shouldn't happen but handle it)
        console.log(`[BASELINE] Step 5: Creating baseline (unexpected - should exist by now)`);
        const summaries = selectSessionsForBaseline(allSummaries);
        if (summaries.length >= 4) {
          const baselineMetrics = calculateBaselineMetrics(summaries);
          await pb.collection('user_baselines').create({
            user_id: userId,
            ...baselineMetrics,
            sessions_count: summaries.length,
            established: true,
            unique_morning_sessions_count: uniqueDays,
            calibration_progress: 100,
            last_updated: currentTime
          });
          console.log(`[BASELINE] Step 5: Baseline created with ${summaries.length} sessions`);
        }
      }

      const result = {
        success: true,
        phase: fullBaselinePhase,
        phaseProgress: 100,
        uniqueDays,
        isFirstSession,
        baselineUpdated: !!existingBaseline,
        baselineCreated: !existingBaseline
      };
      console.log(`[BASELINE] Step 5: Returning:`, result);
      return result;
    }

    // Step 4: If >= 4 and <= 14 and baseline exists: Return phase data
    if (uniqueDays >= 4 && uniqueDays <= 14 && existingBaseline) {
      console.log(`[BASELINE] Step 4: uniqueDays (${uniqueDays}) >= 4 && <= 14, baseline exists - Updating phase to '${progressInfo.phase}'`);
      try {
        await pb.collection('users').update(userId, {
          usage_phase: progressInfo.phase
        });
        console.log(`[BASELINE] Step 4: Updated usage_phase to '${progressInfo.phase}'`);
      } catch (error: any) {
        console.error('[BASELINE] Failed to update usage_phase:', error);
      }

      // Update baseline progress
      try {
        await pb.collection('user_baselines').update(existingBaseline.id, {
          unique_morning_sessions_count: uniqueDays,
          calibration_progress: progressInfo.progress,
          last_updated: currentTime
        });
        console.log(`[BASELINE] Step 4: Updated baseline progress to ${progressInfo.progress}%`);
      } catch (error: any) {
        console.error('[BASELINE] Failed to update baseline:', error);
      }

      const result = {
        success: true,
        phase: progressInfo.phase,
        phaseProgress: progressInfo.progress,
        uniqueDays,
        isFirstSession,
        baselineUpdated: true
      };
      console.log(`[BASELINE] Step 4: Returning:`, result);
      return result;
    }

    // Step 3: If >= 4 AND no baseline exists: Create baseline, update usage_phase, return phase data
    if (uniqueDays >= 4 && !existingBaseline) {
      console.log(`[BASELINE] Step 3: uniqueDays (${uniqueDays}) >= 4, no baseline exists - Creating baseline`);
      const summaries = selectSessionsForBaseline(allSummaries);
      console.log(`[BASELINE] Step 3: Selected ${summaries.length} sessions for baseline calculation`);

      if (summaries.length >= 4) {
        const baselineMetrics = calculateBaselineMetrics(summaries);
        console.log(`[BASELINE] Step 3: Calculated baseline metrics: RMSSD=${baselineMetrics.rmssd_avg?.toFixed(2)}, SDNN=${baselineMetrics.sdnn_avg?.toFixed(2)}`);

        await pb.collection('user_baselines').create({
          user_id: userId,
          ...baselineMetrics,
          sessions_count: summaries.length,
          established: true,
          unique_morning_sessions_count: uniqueDays,
          calibration_progress: progressInfo.progress,
          last_updated: currentTime
        });
        console.log(`[BASELINE] Step 3: Baseline created successfully`);

        await pb.collection('users').update(userId, {
          usage_phase: progressInfo.phase
        });
        console.log(`[BASELINE] Step 3: Updated usage_phase to '${progressInfo.phase}'`);

        const result = {
          success: true,
          phase: progressInfo.phase,
          phaseProgress: progressInfo.progress,
          uniqueDays,
          isFirstSession,
          baselineCreated: true
        };
        console.log(`[BASELINE] Step 3: Returning:`, result);
        return result;
      } else {
        console.log(`[BASELINE] Step 3: Warning - Only ${summaries.length} sessions selected (need >= 4), falling back`);
      }
    }

    // Fallback (should not reach here)
    console.log(`[BASELINE] Fallback: Reached unexpected code path. uniqueDays=${uniqueDays}, hasBaseline=${!!existingBaseline}`);
    return {
      success: true,
      phase: progressInfo.phase,
      phaseProgress: progressInfo.progress,
      uniqueDays,
      isFirstSession
    };

  } catch (error) {
    console.error('[BASELINE] Error in auto baseline check:', error);
    return {
      success: false,
      phase: 'calibration',
      phaseProgress: 0,
      uniqueDays: 0
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

    const daysNeeded = baselineCheck.valid ? 0 : Math.max(0, 4 - baselineCheck.uniqueDays);
    const sessionsNeeded = selectedSessions.length < 4 ? Math.max(0, 4 - selectedSessions.length) : 0;

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

