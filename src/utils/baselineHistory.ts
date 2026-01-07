/**
 * Baseline history utility
 * Creates historical snapshots of user baselines
 */

import PocketBase from 'pocketbase';

/**
 * Create a baseline snapshot for a specific user
 * This should be called before updating the baseline with new session data
 * 
 * @param userId - User ID to snapshot
 * @param pb - PocketBase client instance
 * @returns Success status
 */
export const createBaselineSnapshot = async (userId: string, pb: PocketBase): Promise<{ success: boolean; snapshotId?: string }> => {
    try {
        // Get user's timezone
        let userTimezone = 'UTC';
        try {
            const user = await pb.collection('users').getOne(userId);
            userTimezone = user.timezone || 'UTC';
        } catch {
            // Could not fetch user timezone, using default UTC
        }

        // Get current date for snapshot in USER'S timezone (YYYY-MM-DD)
        // Import toLocalDateString at the top if not already imported
        const { toLocalDateString } = await import('@/utils/dateUtils');
        const snapshotDate = toLocalDateString(new Date(), userTimezone);

        // Check if snapshot already exists for today (idempotent)
        const filterQuery = `user_id = "${userId}" && snapshot_date = "${snapshotDate}"`;

        const existingSnapshots = await pb.collection('baseline_history').getList(1, 1, {
            filter: filterQuery
        });

        if (existingSnapshots.items.length > 0) {
            // Snapshot already exists for today, skip
            return { success: true, snapshotId: existingSnapshots.items[0].id };
        }

        // Fetch current baseline
        let baseline;
        try {
            baseline = await pb.collection('user_baselines').getFirstListItem(`user_id = "${userId}"`);
        } catch (e: any) {
            if (e.status === 404) {
                // No baseline established yet, nothing to snapshot
                return { success: true };
            }
            throw e;
        }

        if (!baseline || !baseline.established) {
            return { success: true };
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
            energy_score_avg: baseline.energy_score_avg,
            energy_score_stdev: baseline.energy_score_stdev,
            stress_score_avg: baseline.stress_score_avg,
            stress_score_stdev: baseline.stress_score_stdev,
            health_score_avg: baseline.health_score_avg,
            health_score_stdev: baseline.health_score_stdev,
            focus_score_avg: baseline.focus_score_avg,
            focus_score_stdev: baseline.focus_score_stdev,
            hrv_score_avg: baseline.hrv_score_avg,
            hrv_score_stdev: baseline.hrv_score_stdev,
            sessions_count: baseline.sessions_count,
            established: baseline.established
        };

        const record = await pb.collection('baseline_history').create(snapshotData);

        return { success: true, snapshotId: record.id };

    } catch {
        // Don't throw - we don't want to block the baseline update process if history fails
        return { success: false };
    }
};
