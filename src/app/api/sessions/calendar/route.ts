import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { chunk } from '@/lib/pbMap';

interface CalendarSession {
  id: string;
  date: string; // YYYY-MM-DD format
  time: string; // HH:MM format
  rmssd: number;
  durationMin: number;
  hrvScore?: number; // HRV Score (0-100)
  notes?: string;
}

// GET /api/sessions/calendar - Optimized endpoint for calendar view
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate'); // Optional: filter by date range
    const endDate = searchParams.get('endDate'); // Optional: filter by date range

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();
    
    // Validate user exists (userId is the PB record ID)
    try {
      await pb.collection('users').getOne(userId);
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build filter for sessions
    let filter = `userId = "${userId}"`;
    
    // Add date range filters if provided
    if (startDate) {
      filter += ` && startTime >= "${startDate}"`;
    }
    if (endDate) {
      filter += ` && startTime <= "${endDate}"`;
    }

    // Fetch all sessions for the user
    const sessionsResponse = await pb.collection('sessions').getList(1, 200, {
      filter,
      sort: '-startTime'
    });

    if (sessionsResponse.items.length === 0) {
      return NextResponse.json({ sessions: [], total: 0 });
    }

    // Get all session IDs
    const sessionIds = sessionsResponse.items.map(session => session.id);

    // Fetch ALL summaries using chunked queries (PocketBase has limits on IN queries)
    const chunkSize = 50;
    const sessionChunks = chunk(sessionIds, chunkSize);
    
    const summaryPromises = sessionChunks.map(sessionChunk => 
      pb.collection('session_summary').getList(1, chunkSize, {
        filter: `session_id in (${sessionChunk.map(id => `"${id}"`).join(',')})`,
      })
    );

    // Execute all summary queries in parallel
    const summaryResponses = await Promise.all(summaryPromises);
    
    // Combine all summaries into a single map
    const summaryMap = new Map();
    summaryResponses.forEach(response => {
      response.items.forEach(summary => {
        summaryMap.set(summary.session_id, summary);
      });
    });

    // Transform sessions to calendar format with summaries
    const calendarSessions: CalendarSession[] = sessionsResponse.items.map(session => {
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMin = Math.round(durationMs / (1000 * 60));
      
      // Format date and time
      const date = startTime.toISOString().slice(0, 10); // YYYY-MM-DD
      const hours = startTime.getHours().toString().padStart(2, '0');
      const minutes = startTime.getMinutes().toString().padStart(2, '0');
      const time = `${hours}:${minutes}`;
      
      // Get summary if available
      const summary = summaryMap.get(session.id);
      const rmssd = summary?.rmssd_session_ms || 0;
      const hrvScore = summary?.hrv_score || null;
      
      return {
        id: session.id,
        date,
        time,
        rmssd: Math.round(rmssd),
        durationMin,
        hrvScore: hrvScore !== null ? Math.round(hrvScore) : undefined,
        notes: summary ? `Session ${session.id.slice(-4)}` : `Session ${session.id.slice(-4)} (No data)`
      };
    });

    // Add response caching headers
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=60'); // Cache for 1 minute

    return NextResponse.json(
      { 
        sessions: calendarSessions, 
        total: sessionsResponse.totalItems,
        cached: false 
      },
      { headers }
    );

  } catch (error: unknown) {
    console.error('Error fetching calendar sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
