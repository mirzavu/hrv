import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';
import { formatDateForPocketBase } from '@/utils/dateUtils';

/**
 * GET /api/user/baseline-history
 * 
 * Fetches the most recent baseline snapshot that existed at least 18 hours before a given date.
 * Used for comparing historical sessions against the baseline that was active at that time.
 * 
 * Query params:
 * - userId: User ID (required)
 * - beforeDate: ISO datetime string - only baselines at least 18 hours before this date (required)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const beforeDate = searchParams.get('beforeDate');
        const debug = searchParams.get('debug') === 'true';

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            );
        }

        if (!beforeDate) {
            return NextResponse.json(
                { error: 'beforeDate is required' },
                { status: 400 }
            );
        }

        const pb = await getAdminPb();

        // If debug mode, return counts only
        if (debug) {
            const allRecords = await pb.collection('baseline_history').getList(1, 200, {
                filter: `user_id = "${userId}"`
            });

            const establishedCount = allRecords.items.filter(r => r.established === true).length;

            return NextResponse.json({
                baseline: null,
                baselineDatetime: null,
                debug: {
                    totalRecords: allRecords.items.length,
                    establishedRecords: establishedCount
                }
            });
        }

        // Calculate the cutoff date (18 hours before the session)
        const sessionDate = new Date(beforeDate);
        const cutoffDate = new Date(sessionDate.getTime() - (18 * 60 * 60 * 1000)); // 18 hours in milliseconds

        // Format for PocketBase
        const pbCutoffDate = formatDateForPocketBase(cutoffDate);

        // Query for baseline snapshots before cutoff
        const filter = `user_id = "${userId}" && snapshot_date <= "${pbCutoffDate}"`;

        const snapshots = await pb.collection('baseline_history').getList(1, 50, {
            filter,
            sort: '-snapshot_date'
        });

        // Filter for established baselines only
        const validSnapshots = snapshots.items.filter(s => s.established === true);

        if (validSnapshots.length === 0) {
            return NextResponse.json({
                baseline: null,
                baselineDatetime: null
            });
        }

        const snapshot = withDollarId(validSnapshots[0]);

        // Transform the snapshot to match UserBaseline interface
        const baseline = {
            user_id: snapshot.user_id,
            rmssd_avg: snapshot.rmssd_avg,
            rmssd_stdev: snapshot.rmssd_stdev,
            sdnn_avg: snapshot.sdnn_avg,
            sdnn_stdev: snapshot.sdnn_stdev,
            hr_avg: snapshot.hr_avg,
            hr_stdev: snapshot.hr_stdev,
            lf_power_avg: snapshot.lf_power_avg,
            hf_power_avg: snapshot.hf_power_avg,
            lf_hf_avg: snapshot.lf_hf_avg,
            amo50_avg: snapshot.amo50_avg,
            sd1_sd2_ratio_avg: snapshot.sd1_sd2_ratio_avg,
            sd1_sd2_ratio_stdev: snapshot.sd1_sd2_ratio_stdev,
            energy_score_avg: snapshot.energy_score_avg,
            energy_score_stdev: snapshot.energy_score_stdev,
            stress_score_avg: snapshot.stress_score_avg,
            stress_score_stdev: snapshot.stress_score_stdev,
            health_score_avg: snapshot.health_score_avg,
            health_score_stdev: snapshot.health_score_stdev,
            focus_score_avg: snapshot.focus_score_avg,
            focus_score_stdev: snapshot.focus_score_stdev,
            hrv_score_avg: snapshot.hrv_score_avg,
            hrv_score_stdev: snapshot.hrv_score_stdev,
            sessions_count: snapshot.sessions_count,
            established: snapshot.established
        };

        return NextResponse.json({
            baseline,
            baselineDatetime: snapshot.snapshot_date // Full datetime of when baseline was created
        });

    } catch (error: unknown) {
        console.error('Error fetching baseline history:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch baseline history',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
