import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { DEFAULT_TIMEZONE, toLocalDateString, getWeeklyReportStartDate, getWeeklyReportEndDate } from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const userId = body.userId;

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
            console.warn('[Weekly Viewed API] Could not fetch user data, using defaults');
        }

        // Get current week range
        const referenceDate = new Date();
        const endDate = getWeeklyReportEndDate(userTimezone, referenceDate);
        const startDate = getWeeklyReportStartDate(new Date(), userTimezone, referenceDate);
        const startLocalDate = toLocalDateString(startDate, userTimezone);
        const weekStartForQuery = `${startLocalDate} 00:00:00.000Z`;

        // Find and update the weekly_insights record
        try {
            const existing = await pb.collection('weekly_insights').getList(1, 1, {
                filter: `user_id = "${userId}" && week_start = "${weekStartForQuery}"`,
            });

            if (existing.items.length > 0) {
                await pb.collection('weekly_insights').update(existing.items[0].id, {
                    viewed: true,
                });
                return NextResponse.json({ success: true });
            } else {
                // If no insight exists yet, that's okay - it will be marked when created
                return NextResponse.json({ success: true, message: 'No insight found for current week' });
            }
        } catch (updateError) {
            console.error('[Weekly Viewed API] Error updating viewed status:', updateError);
            return NextResponse.json(
                { error: 'Failed to update viewed status' },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('[Weekly Viewed API] Error:', error);
        return NextResponse.json(
            { error: 'Failed to mark report as viewed', details: error.message },
            { status: 500 }
        );
    }
}

