import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { toLocalDateString, DEFAULT_TIMEZONE } from '@/utils/dateUtils';

interface MonthDateData {
  date: string; // YYYY-MM-DD format
  count: number;
  sessions: Array<{ id: string; rmssd: number }>;
}

// GET /api/sessions/calendar/month - Fetch month aggregates for calendar view
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Validate user exists and get timezone
    let userTimezone = DEFAULT_TIMEZONE;
    try {
      const user = await pb.collection('users').getOne(userId);
      userTimezone = user.timezone || DEFAULT_TIMEZONE;
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[Calendar Month] User timezone: ${userTimezone}`);

    // Import day boundary utilities
    const { getLocalDayStartUTC, getLocalDayEndUTC } = await import('@/utils/dateUtils');

    // Convert local date strings to UTC boundaries for query
    // Expand the range by ±1 day to account for timezone offsets
    // This ensures we capture all sessions that fall on the first/last day of the month in user's timezone
    const startDateObj = new Date(startDate + 'T00:00:00');
    startDateObj.setDate(startDateObj.getDate() - 1);
    const expandedStartDate = startDateObj.toISOString().split('T')[0];
    
    const endDateObj = new Date(endDate + 'T00:00:00');
    endDateObj.setDate(endDateObj.getDate() + 1);
    const expandedEndDate = endDateObj.toISOString().split('T')[0];

    const startUTC = getLocalDayStartUTC(expandedStartDate, userTimezone);
    const endUTC = getLocalDayEndUTC(expandedEndDate, userTimezone);

    const startDateTime = startUTC.toISOString();
    const endDateTime = endUTC.toISOString();

    let filter = `user_id = "${userId}" && session_date >= "${startDateTime}" && session_date <= "${endDateTime}"`;

    console.log(`[Calendar Month] Fetching for user ${userId}, local date range: ${startDate} to ${endDate}, expanded UTC range: ${startDateTime} to ${endDateTime}`);

    // Fetch all summaries for the month (with expanded range to account for timezone)
    let summariesResponse = await pb.collection('session_summary').getList(1, 1000, {
      filter,
      sort: '-session_date',
      fields: 'id,session_id,session_date,rmssd_session_ms'
    });

    console.log(`[Calendar Month] Range query found ${summariesResponse.items.length} summaries`);

    // Fallback: substring match on session_date if needed
    if (summariesResponse.items.length === 0) {
      const fallbackResponse = await pb.collection('session_summary').getList(1, 1000, {
        filter: `user_id = "${userId}" && session_date ~ "${startDate.slice(0, 7)}"`,
        sort: '-session_date',
        fields: 'id,session_id,session_date,rmssd_session_ms'
      });
      console.log(`[Calendar Month] Fallback substring query found ${fallbackResponse.items.length} summaries`);
      if (fallbackResponse.items.length > 0) {
        summariesResponse = fallbackResponse;
      }
    }

    console.log(`[Calendar Month] Using ${summariesResponse.items.length} summaries for processing`);

    if (summariesResponse.items.length === 0) {
      return NextResponse.json({ dates: [] });
    }

    // Group by date and get first 3 sessions per date
    const dateMap = new Map<string, { sessions: Array<{ id: string; rmssd: number }>; count: number }>();

    summariesResponse.items.forEach((summary: any) => {
      // Extract date from session_date, converting to USER's timezone using dateUtils
      if (!summary.session_date) return;

      // Use the proper timezone-aware conversion
      const dateStr = toLocalDateString(summary.session_date, userTimezone);

      // Filter to only include dates within the requested month range
      // This filters out the expanded range sessions that don't fall in the actual month
      if (dateStr < startDate || dateStr > endDate) {
        return;
      }

      // Debug: Log date conversion for debugging timezone issues (only for Jan 1)
      if (dateStr === '2026-01-01' || dateStr === '2025-01-01') {
        console.log(`[Calendar Month DEBUG] Jan 1 session: session_date raw: ${summary.session_date} -> userTZ: ${userTimezone} -> local: ${dateStr}`);
      }
      if (!dateStr) return;

      if (!dateMap.has(dateStr)) {
        dateMap.set(dateStr, { sessions: [], count: 0 });
      }

      const dateData = dateMap.get(dateStr)!;
      dateData.count++;

      // Only keep first 3 sessions per date (for dot colors)
      if (dateData.sessions.length < 3) {
        dateData.sessions.push({
          id: summary.session_id,
          rmssd: Math.round(summary.rmssd_session_ms || 0)
        });
      }
    });

    // Convert to array format
    const dates: MonthDateData[] = Array.from(dateMap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      sessions: data.sessions
    }));

    // Sort by date
    dates.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ dates });

  } catch (error: unknown) {
    console.error('Error fetching month calendar data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch month calendar data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

