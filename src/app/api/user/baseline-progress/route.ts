import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { toLocalDateString, DEFAULT_TIMEZONE } from '@/utils/dateUtils';

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

        // Get user's timezone
        let userTimezone = DEFAULT_TIMEZONE;
        try {
            const user = await pb.collection('users').getOne(userId);
            userTimezone = user.timezone || DEFAULT_TIMEZONE;
        } catch {
            console.warn('[BASELINE_PROGRESS_API] Could not get user timezone, using default');
        }

        // Fetch sessions to count unique days
        let uniqueDays = 0;
        let phase: 'calibration' | 'early_baseline' | 'full_baseline' = 'calibration';

        try {
            // Get session summaries to count unique dates
            const sessions = await pb.collection('session_summary').getFullList({
                filter: `user_id = "${userId}"`,
                fields: 'session_date'
            });

            // Count unique days using user's timezone
            const uniqueDates = new Set(
                sessions.map(s => {
                    if (!s.session_date) return null;
                    return toLocalDateString(s.session_date, userTimezone);
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
        } catch (error: unknown) {
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
