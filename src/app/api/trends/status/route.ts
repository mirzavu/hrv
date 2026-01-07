import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { DEFAULT_TIMEZONE, toLocalDateString, getCurrentWeekRange } from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

/**
 * Unified endpoint to check viewed status for both weekly and monthly reports
 * 
 * Returns:
 * {
 *   weekly: { viewed: boolean, exists: boolean },
 *   monthly: { viewed: boolean, exists: boolean }
 * }
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
            console.warn('[Trends Status API] Could not fetch user data, using defaults');
        }

        // --- Weekly Status Calculation ---
        // Get current week's Sunday (start of week)
        const { sunday } = getCurrentWeekRange(userTimezone);
        const weekStartLocalDate = toLocalDateString(sunday, userTimezone);
        const weekStartForQuery = `${weekStartLocalDate} 00:00:00.000Z`;

        // --- Monthly Status Calculation ---
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth(); // 0-indexed
        // Get first day of current month in user timezone
        // Note: Constructing simplified local date string for the 1st of the month
        // Ideally we should use userTimezone to find "current month" but using server time mapped to 'YYYY-MM-01' is usually sufficient for "current month" check if offset isn't huge.
        // Better: Use toLocalDateString on today, then replace day with '01'
        const todayLocal = toLocalDateString(today, userTimezone);
        const monthStartLocal = todayLocal.substring(0, 8) + '01'; // YYYY-MM-01
        const monthStartForQuery = `${monthStartLocal} 00:00:00.000Z`;

        // Run checks in parallel
        const [weeklyResult, monthlyResult] = await Promise.all([
            pb.collection('weekly_insights').getList(1, 1, {
                filter: `user_id = "${userId}" && week_start = "${weekStartForQuery}"`,
            }).catch(() => ({ items: [] as any[] })),

            pb.collection('monthly_insights').getList(1, 1, {
                filter: `user_id = "${userId}" && month_start = "${monthStartForQuery}"`,
            }).catch(() => ({ items: [] as any[] }))
        ]);

        const weeklyStatus = {
            exists: weeklyResult.items.length > 0,
            viewed: weeklyResult.items.length > 0 ? !!weeklyResult.items[0].viewed : false
        };

        const monthlyStatus = {
            exists: monthlyResult.items.length > 0,
            viewed: monthlyResult.items.length > 0 ? !!monthlyResult.items[0].viewed : false
        };

        return NextResponse.json({
            weekly: weeklyStatus,
            monthly: monthlyStatus
        });

    } catch (error: any) {
        console.error('[Trends Status API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to check report status', details: error.message },
            { status: 500 }
        );
    }
}
