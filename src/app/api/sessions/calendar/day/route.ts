import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { toLocalDateString, formatLocalTime, DEFAULT_TIMEZONE } from '@/utils/dateUtils';

interface CalendarSession {
  id: string;
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
  rmssd: number;
  durationMin: number;
  hrvScore?: number; // HRV Score (0-100)
  notes?: string;
}

// GET /api/sessions/calendar/day - Fetch sessions for a specific date
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date'); // YYYY-MM-DD format

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 });
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

    console.log(`[Calendar Day] Fetching sessions for user ${userId}, date: ${date}, timezone: ${userTimezone}`);

    // Fetch sessions around the requested date (wider range to account for timezone)
    // We'll filter by local date after fetching
    const summariesResponse = await pb.collection('session_summary').getList(1, 100, {
      filter: `user_id = "${userId}"`,
      sort: '-session_date',
      fields: 'id,session_id,session_date,rmssd_session_ms,hrv_score'
    });

    // Filter sessions that fall on the requested LOCAL date
    const filteredSummaries = summariesResponse.items.filter((summary: any) => {
      if (!summary.session_date) return false;
      const localDate = toLocalDateString(summary.session_date, userTimezone);

      // Debug: Log specific session conversion
      if (summary.session_id?.includes('4jv4j82')) {
        console.log(`[Calendar Day DEBUG] Session ${summary.session_id}: raw=${summary.session_date}, tz=${userTimezone}, localDate=${localDate}, requested=${date}, match=${localDate === date}`);
      }

      return localDate === date;
    });

    console.log(`[Calendar Day] Found ${filteredSummaries.length} summaries for local date ${date}`);

    if (filteredSummaries.length === 0) {
      console.log(`[Calendar Day] No summaries found for local date ${date}`);
      return NextResponse.json({ sessions: [] });
    }

    // Get session IDs from filtered summaries
    const sessionIds = filteredSummaries.map((summary: any) => summary.session_id);

    // Now fetch the actual sessions to get startTime/endTime
    const sessionsMap = new Map();
    if (sessionIds.length > 0) {
      try {
        // Try batch query
        const sessionsFilter = `userId = "${userId}" && (${sessionIds.map(id => `id = "${id}"`).join(' || ')})`;
        const sessionsResponse = await pb.collection('sessions').getList(1, 100, {
          filter: sessionsFilter,
          sort: '-startTime'
        });
        sessionsResponse.items.forEach((session: any) => {
          sessionsMap.set(session.id, session);
        });
        console.log(`[Calendar Day] Found ${sessionsMap.size} sessions`);
      } catch (error) {
        console.error('[Calendar Day] Batch session fetch failed, trying individual queries:', error);
        // Fallback: fetch sessions individually
        const sessionResults = await Promise.allSettled(
          sessionIds.map((id) =>
            pb.collection('sessions').getOne(id)
          )
        );
        sessionResults.forEach((res) => {
          if (res.status === 'fulfilled') {
            sessionsMap.set(res.value.id, res.value);
          }
        });
        console.log(`[Calendar Day] Individual queries found ${sessionsMap.size} sessions`);
      }
    }
    // Transform sessions to calendar format
    // Use filtered summaries to get session IDs, then match with sessions for startTime/endTime
    const calendarSessions: CalendarSession[] = filteredSummaries
      .map((summary: any) => {
        const session = sessionsMap.get(summary.session_id);
        if (!session) {
          console.warn(`[Calendar Day] Session ${summary.session_id} not found in sessions table`);
          return null;
        }
        const startTime = new Date(session.startTime);
        const endTime = new Date(session.endTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMin = Math.round(durationMs / (1000 * 60));

        // Format date and time using user's timezone
        const dateStr = toLocalDateString(startTime, userTimezone);
        const time = formatLocalTime(startTime, userTimezone);

        // Get summary data
        const rmssd = summary?.rmssd_session_ms || 0;
        const hrvScore = summary?.hrv_score || null;

        const calendarSession: CalendarSession = {
          id: session.id,
          date: dateStr,
          time,
          rmssd: Math.round(rmssd),
          durationMin,
          hrvScore: hrvScore !== null ? Math.round(hrvScore) : undefined,
          notes: summary ? `Session ${session.id.slice(-4)}` : `Session ${session.id.slice(-4)} (No data)`
        };
        return { ...calendarSession, _startTimeMs: startTime.getTime() };
      })
      .filter((s): s is any => s !== null)
      .sort((a, b) => b._startTimeMs - a._startTimeMs) // Sort by actual timestamp descending
      .map(({ _startTimeMs, ...session }) => session); // Remove temp field

    return NextResponse.json({ sessions: calendarSessions });

  } catch (error: unknown) {
    console.error('Error fetching day sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch day sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

