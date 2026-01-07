import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { DEFAULT_TIMEZONE, toLocalDateString, getCurrentWeekRange } from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

/**
 * Lightweight endpoint to check weekly report viewed status without generating insights
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const pb = await getAdminPb();

        // Get user's timezone
        let userTimezone = DEFAULT_TIMEZONE;
        try {
            const user = await pb.collection('users').getOne(userId);
            userTimezone = user.timezone || DEFAULT_TIMEZONE;
        } catch {
            console.warn('[Weekly Status API] Could not fetch user data, using defaults');
        }

        // Get current week's Sunday (start of week)
        const { sunday } = getCurrentWeekRange(userTimezone);
        const weekStartLocalDate = toLocalDateString(sunday, userTimezone);
        const weekStartForQuery = `${weekStartLocalDate} 00:00:00.000Z`;



        // Check if insight exists and get viewed status
        try {
            const existing = await pb.collection('weekly_insights').getList(1, 1, {
                filter: `user_id = "${userId}" && week_start = "${weekStartForQuery}"`,
            });



            if (existing.items.length > 0) {
                return NextResponse.json({
                    viewed: !!existing.items[0].viewed,
                    exists: true
                });
            } else {
                // No insight exists yet
                return NextResponse.json({
                    viewed: false,
                    exists: false
                });
            }
        } catch (checkError) {
            console.error('[Weekly Status API] Error checking status:', checkError);
            return NextResponse.json({
                viewed: false,
                exists: false
            });
        }
    } catch (error: any) {
        console.error('[Weekly Status API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to check report status', details: error.message },
            { status: 500 }
        );
    }
}

