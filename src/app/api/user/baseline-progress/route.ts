import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

/**
 * GET /api/user/baseline-progress
 * Returns the user's baseline calibration progress for dropdown display
 * Computes unique days on the fly from session_summary table
 */
export async function GET(request: NextRequest) {
    try {
        const userId = request.nextUrl.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId parameter' },
                { status: 400 }
            );
        }

        const pb = await getAdminPb();

        // Fetch sessions to count unique days
        let uniqueDays = 0;
        let phase: 'calibration' | 'early_baseline' | 'full_baseline' = 'calibration';

        try {
            // Get session summaries to count unique dates
            const sessions = await pb.collection('session_summary').getFullList({
                filter: `user_id = "${userId}"`,
                fields: 'session_date'
            });

            // Count unique days (by date, not datetime)
            const uniqueDates = new Set(
                sessions.map(s => {
                    const date = s.session_date ? new Date(s.session_date).toISOString().split('T')[0] : null;
                    return date;
                }).filter(Boolean)
            );
            uniqueDays = uniqueDates.size;

            // Determine phase based on unique days
            if (uniqueDays >= 15) {
                phase = 'full_baseline';
            } else if (uniqueDays >= 4) {
                phase = 'early_baseline';
            } else {
                phase = 'calibration';
            }
        } catch (error: any) {
            console.error('[BASELINE_PROGRESS_API] Error fetching sessions:', error);
        }

        // Calculate progress percentage (0-100)
        const progress = Math.min(Math.round((uniqueDays / 15) * 100), 100);

        return NextResponse.json({
            uniqueDays,
            progress,
            phase,
            totalDays: 15
        });
    } catch (error) {
        console.error('[BASELINE_PROGRESS_API] Server error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
