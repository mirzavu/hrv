/**
 * Baseline history utility for weekly snapshot creation
 * Creates historical snapshots of user baselines for long-term progress tracking
 */

import { getAdminPb } from '@/lib/pbAdmin';
import type { UserBaseline } from '@/types';

/**
 * Create weekly baseline snapshots for all users with established baselines
 * Called by cron job every Monday at 00:00 UTC
 * 
 * @returns Result object with success status and details
 */
export const createWeeklyBaselineSnapshots = async (): Promise<{
  success: boolean;
  snapshotsCreated: number;
  errors: Array<{ userId: string; error: string }>;
}> => {
  const errors: Array<{ userId: string; error: string }> = [];
  let snapshotsCreated = 0;

  try {
    const pb = await getAdminPb();

    // Get current date for snapshot (Monday)
    const snapshotDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log(`[BASELINE_HISTORY] Starting weekly snapshot creation for date: ${snapshotDate}`);

    // Fetch all users with established baselines
    // We need to get all baselines, then get unique user_ids
    let allBaselines: any[] = [];
    let page = 1;
    const perPage = 500;

    while (true) {
      const result = await pb.collection('user_baselines').getList(page, perPage, {
        filter: 'established = true',
        sort: '-last_updated'
      });

      allBaselines = allBaselines.concat(result.items);

      if (result.items.length < perPage) {
        break; // Last page
      }
      page++;
    }

    console.log(`[BASELINE_HISTORY] Found ${allBaselines.length} established baselines`);

    // Get unique user IDs
    const userIds = [...new Set(allBaselines.map(b => b.user_id))];
    console.log(`[BASELINE_HISTORY] Processing ${userIds.length} unique users`);

    // Check if snapshot already exists for today (idempotent - don't create duplicates)
    const existingSnapshots = await pb.collection('baseline_history').getList(1, 1000, {
      filter: `snapshot_date = "${snapshotDate}"`
    });

    const existingUserIds = new Set(existingSnapshots.items.map(s => s.user_id));
    console.log(`[BASELINE_HISTORY] Found ${existingSnapshots.items.length} existing snapshots for today`);

    // Create snapshot for each user
    for (const userId of userIds) {
      try {
        // Skip if snapshot already exists for this user today
        if (existingUserIds.has(userId)) {
          console.log(`[BASELINE_HISTORY] Snapshot already exists for user ${userId} on ${snapshotDate} - skipping`);
          continue;
        }

        // Find baseline for this user
        const baseline = allBaselines.find(b => b.user_id === userId);
        if (!baseline) {
          console.warn(`[BASELINE_HISTORY] Baseline not found for user ${userId} - skipping`);
          continue;
        }

        // Create snapshot document
        const snapshotData = {
          user_id: userId,
          snapshot_date: snapshotDate,
          rmssd_avg: baseline.rmssd_avg,
          rmssd_stdev: baseline.rmssd_stdev,
          sdnn_avg: baseline.sdnn_avg,
          sdnn_stdev: baseline.sdnn_stdev,
          hr_avg: baseline.hr_avg,
          hr_stdev: baseline.hr_stdev,
          lf_power_avg: baseline.lf_power_avg,
          hf_power_avg: baseline.hf_power_avg,
          lf_hf_avg: baseline.lf_hf_avg,
          amo50_avg: baseline.amo50_avg,
          sd1_sd2_ratio_avg: baseline.sd1_sd2_ratio_avg,
          sd1_sd2_ratio_stdev: baseline.sd1_sd2_ratio_stdev,
          sessions_count: baseline.sessions_count,
          established: baseline.established
        };

        await pb.collection('baseline_history').create(snapshotData);
        snapshotsCreated++;
        console.log(`[BASELINE_HISTORY] Created snapshot for user ${userId}`);

      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        console.error(`[BASELINE_HISTORY] Error creating snapshot for user ${userId}:`, errorMessage);
        errors.push({
          userId,
          error: errorMessage
        });
        // Continue with next user - don't fail entire batch
      }
    }

    console.log(`[BASELINE_HISTORY] Snapshot creation completed: ${snapshotsCreated} created, ${errors.length} errors`);

    return {
      success: errors.length === 0,
      snapshotsCreated,
      errors
    };

  } catch (error: any) {
    console.error('[BASELINE_HISTORY] Fatal error in snapshot creation:', error);
    return {
      success: false,
      snapshotsCreated,
      errors: [
        ...errors,
        {
          userId: 'system',
          error: error.message || 'Fatal error in snapshot creation'
        }
      ]
    };
  }
};

