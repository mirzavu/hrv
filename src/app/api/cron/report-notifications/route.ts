import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { createReportNotification } from '@/utils/notifications';
import {
    toLocalDateString,
    DEFAULT_TIMEZONE,
    formatDateForPocketBase,
    getLocalDayStartUTC,
    getLocalDayEndUTC,
} from '@/utils/dateUtils';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint to check for available reports and create notifications
 * Should be called daily (preferably early morning UTC)
 * 
 * Logic:
 * - Weekly: If today is Sunday, check if previous week (Sun-Sat) has data
 * - Monthly: If today is 1st-3rd of month, check if previous month has ≥7 sessions
 */
export async function GET(request: NextRequest) {
    try {
        const pb = await getAdminPb();

        // Fetch all users
        const users = await pb.collection('users').getFullList({
            fields: 'id,timezone',
        });

        console.log(`[CRON] Processing ${users.length} users for report notifications`);

        let weeklyCreated = 0;
        let monthlyCreated = 0;
        let weeklySkipped = 0;
        let monthlySkipped = 0;

        // Process each user
        for (const user of users) {
            const userId = user.id;
            const userTimezone = user.timezone || DEFAULT_TIMEZONE;

            // Helper to format date in user's timezone
            const formatLocalDate = (d: Date) => toLocalDateString(d, userTimezone);

            // Get current date in user's timezone
            const now = new Date();
            const nowLocal = formatLocalDate(now);
            const [yearStr, monthStr, dayStr] = nowLocal.split('-');
            const currentYear = parseInt(yearStr);
            const currentMonth = parseInt(monthStr) - 1; // 0-indexed
            const currentDay = parseInt(dayStr);

            // Get day of week in user's timezone
            const nowInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
            const dayOfWeek = nowInUserTZ.getDay(); // 0 = Sunday, 6 = Saturday

            // --- WEEKLY CHECK ---
            // If today is Sunday (day 0), previous week (Sun-Sat) is complete
            if (dayOfWeek === 0) {
                // Calculate previous week's Sunday-Saturday
                const previousSaturday = new Date(currentYear, currentMonth, currentDay - 1); // Yesterday (Saturday)
                const previousSunday = new Date(previousSaturday);
                previousSunday.setDate(previousSaturday.getDate() - 6); // 6 days before Saturday

                const weekStartLocal = formatLocalDate(previousSunday);
                const weekEndLocal = formatLocalDate(previousSaturday);

                // Expand range for query
                const expandedStart = new Date(previousSunday);
                expandedStart.setDate(expandedStart.getDate() - 1);
                const expandedEnd = new Date(previousSaturday);
                expandedEnd.setDate(expandedEnd.getDate() + 1);

                const startUTC = getLocalDayStartUTC(formatLocalDate(expandedStart), userTimezone);
                const endUTC = getLocalDayEndUTC(formatLocalDate(expandedEnd), userTimezone);

                const startStr = formatDateForPocketBase(startUTC);
                const endStr = formatDateForPocketBase(endUTC);

                // Check if there's at least 1 session in this week
                const sessions = await pb.collection('session_summary').getList(1, 1, {
                    filter: `user_id = "${userId}" && session_date >= "${startStr}" && session_date <= "${endStr}"`,
                });

                if (sessions.items.length > 0) {
                    // Week has data, create notification
                    const weekStartForNotification = `${weekStartLocal} 00:00:00.000Z`;
                    const created = await createReportNotification(userId, 'weekly', weekStartForNotification);
                    if (created) {
                        weeklyCreated++;
                        console.log(`[CRON] ✅ Created weekly notification for user ${userId.substring(0, 8)}... (${weekStartLocal} - ${weekEndLocal})`);
                    } else {
                        weeklySkipped++;
                    }
                } else {
                    weeklySkipped++;
                    console.log(`[CRON] ⏭️  Skipped weekly for user ${userId.substring(0, 8)}... (no data for ${weekStartLocal} - ${weekEndLocal})`);
                }
            }

            // --- MONTHLY CHECK ---
            // If today is 1st, 2nd, or 3rd of the month, previous month is complete
            if (currentDay >= 1 && currentDay <= 3) {
                // Calculate previous month
                const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

                const monthStart = new Date(previousYear, previousMonth, 1);
                const monthEnd = new Date(previousYear, previousMonth + 1, 0); // Last day of previous month

                const monthStartLocal = formatLocalDate(monthStart);
                const monthEndLocal = formatLocalDate(monthEnd);

                // Expand range for query
                const expandedStart = new Date(monthStart);
                expandedStart.setDate(expandedStart.getDate() - 1);
                const expandedEnd = new Date(monthEnd);
                expandedEnd.setDate(expandedEnd.getDate() + 1);

                const startUTC = getLocalDayStartUTC(formatLocalDate(expandedStart), userTimezone);
                const endUTC = getLocalDayEndUTC(formatLocalDate(expandedEnd), userTimezone);

                const startStr = formatDateForPocketBase(startUTC);
                const endStr = formatDateForPocketBase(endUTC);

                // Check if there are at least 7 sessions in this month (≈1 week of data)
                const sessions = await pb.collection('session_summary').getList(1, 10, {
                    filter: `user_id = "${userId}" && session_date >= "${startStr}" && session_date <= "${endStr}"`,
                });

                if (sessions.items.length >= 7) {
                    // Month has sufficient data, create notification
                    const monthStartForNotification = `${monthStartLocal} 00:00:00.000Z`;
                    const created = await createReportNotification(userId, 'monthly', monthStartForNotification);
                    if (created) {
                        monthlyCreated++;
                        console.log(`[CRON] ✅ Created monthly notification for user ${userId.substring(0, 8)}... (${monthStartLocal} - ${monthEndLocal})`);
                    } else {
                        monthlySkipped++;
                    }
                } else {
                    monthlySkipped++;
                    console.log(`[CRON] ⏭️  Skipped monthly for user ${userId.substring(0, 8)}... (only ${sessions.items.length} sessions for ${monthStartLocal} - ${monthEndLocal})`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            summary: {
                totalUsers: users.length,
                weekly: {
                    created: weeklyCreated,
                    skipped: weeklySkipped,
                },
                monthly: {
                    created: monthlyCreated,
                    skipped: monthlySkipped,
                },
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[CRON] Error processing report notifications:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process report notifications',
                details: error.message,
            },
            { status: 500 }
        );
    }
}
