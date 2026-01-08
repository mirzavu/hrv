import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { DEFAULT_TIMEZONE, toLocalDateString, getCurrentWeekRange } from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

/**
 * Consolidated user status endpoint
 * Aggregates: usagePhase, baselineEstablished, and trends report status
 * 
 * Returns:
 * {
 *   usagePhase: 'calibration' | 'early_baseline' | 'full_baseline',
 *   baselineEstablished: boolean,
 *   trends: {
 *     weekly: { viewed: boolean, exists: boolean },
 *     monthly: { viewed: boolean, exists: boolean }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    try {
        const pb = await getAdminPb();

        // Run all fetches in parallel for speed
        const [userResult, baselineResult] = await Promise.allSettled([
            pb.collection('users').getOne(userId),
            pb.collection('user_baselines').getFirstListItem(`user_id = "${userId}"`)
        ]);

        // 1. Profile Data & Timezone
        const profile = userResult.status === 'fulfilled' ? userResult.value : null;
        const usagePhase = profile?.usage_phase || 'calibration';
        const userTimezone = profile?.timezone || DEFAULT_TIMEZONE;

        // 2. Baseline Status (404 = not established)
        const baseline = baselineResult.status === 'fulfilled' ? baselineResult.value : null;
        const baselineEstablished = baseline?.established === true;

        // 3. Trends Status - need timezone for date calculations
        // Weekly: Get current week's Sunday
        const { sunday } = getCurrentWeekRange(userTimezone);
        const weekStartLocalDate = toLocalDateString(sunday, userTimezone);
        const weekStartForQuery = `${weekStartLocalDate} 00:00:00.000Z`;

        // Monthly: Get first day of current month
        const today = new Date();
        const todayLocal = toLocalDateString(today, userTimezone);
        const monthStartLocal = todayLocal.substring(0, 8) + '01'; // YYYY-MM-01
        const monthStartForQuery = `${monthStartLocal} 00:00:00.000Z`;

        // Fetch trends status in parallel
        const [weeklyResult, monthlyResult] = await Promise.all([
            pb.collection('weekly_insights').getList(1, 1, {
                filter: `user_id = "${userId}" && week_start = "${weekStartForQuery}"`,
            }).catch(() => ({ items: [] as unknown[] })),

            pb.collection('monthly_insights').getList(1, 1, {
                filter: `user_id = "${userId}" && month_start = "${monthStartForQuery}"`,
            }).catch(() => ({ items: [] as unknown[] }))
        ]);

        const weeklyStatus = {
            exists: weeklyResult.items.length > 0,
            viewed: weeklyResult.items.length > 0 ? !!(weeklyResult.items[0] as { viewed?: boolean }).viewed : true
        };

        const monthlyStatus = {
            exists: monthlyResult.items.length > 0,
            viewed: monthlyResult.items.length > 0 ? !!(monthlyResult.items[0] as { viewed?: boolean }).viewed : true
        };

        return NextResponse.json({
            usagePhase,
            baselineEstablished,
            trends: {
                weekly: weeklyStatus,
                monthly: monthlyStatus
            }
        });

    } catch (error) {
        console.error('[API] Error fetching user status:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
