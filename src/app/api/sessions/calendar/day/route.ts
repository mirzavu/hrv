import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

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
    
    // Validate user exists
    try {
      await pb.collection('users').getOne(userId);
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[Calendar Day] Fetching sessions for user ${userId}, date: ${date}`);

    // session_date is stored as datetime (e.g., '2025-11-10 16:33:13.482Z')
    // So we need to filter by date range covering the entire day and use the same format (with space separator)
    const startDateTime = `${date} 00:00:00.000Z`;
    const endDateTime = `${date} 23:59:59.999Z`;

    // Query session_summary by session_date range
    let summariesResponse = await pb.collection('session_summary').getList(1, 100, {
      filter: `user_id = "${userId}" && session_date >= "${startDateTime}" && session_date <= "${endDateTime}"`,
      sort: '-session_date',
      fields: 'id,session_id,session_date,rmssd_session_ms,hrv_score'
    });

    console.log(`[Calendar Day] Range query (${startDateTime} to ${endDateTime}) found ${summariesResponse.items.length} summaries for date ${date}`);

    // Fallback: if range returns nothing, try substring match (in case PB stores in slightly different format)
    if (summariesResponse.items.length === 0) {
      const fallbackResponse = await pb.collection('session_summary').getList(1, 100, {
        filter: `user_id = "${userId}" && session_date ~ "${date}"`,
        sort: '-session_date',
        fields: 'id,session_id,session_date,rmssd_session_ms,hrv_score'
      });
      console.log(`[Calendar Day] Fallback substring query found ${fallbackResponse.items.length} summaries for date ${date}`);
      if (fallbackResponse.items.length > 0) {
        summariesResponse = fallbackResponse;
      }
    }

    if (summariesResponse.items.length === 0) {
      console.log(`[Calendar Day] No summaries found after range + fallback, returning empty array`);
      return NextResponse.json({ sessions: [] });
    }

    // Get session IDs from summaries
    const sessionIds = summariesResponse.items.map((summary: any) => summary.session_id);
    
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
    // Use summaries to get session IDs, then match with sessions for startTime/endTime
    const calendarSessions: CalendarSession[] = summariesResponse.items
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
        
        // Format date and time
        const dateStr = startTime.toISOString().slice(0, 10); // YYYY-MM-DD
        const hours = startTime.getHours().toString().padStart(2, '0');
        const minutes = startTime.getMinutes().toString().padStart(2, '0');
        const time = `${hours}:${minutes}`;
        
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
        return calendarSession;
      })
      .filter((s): s is CalendarSession => s !== null)
      .sort((a, b) => a.time.localeCompare(b.time)); // Sort by time

    return NextResponse.json({ sessions: calendarSessions });

  } catch (error: unknown) {
    console.error('Error fetching day sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch day sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

