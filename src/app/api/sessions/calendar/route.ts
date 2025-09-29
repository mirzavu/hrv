import { NextRequest, NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';

// Create server-side Appwrite client with API key
const client = new Client();
client
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;
const SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID!;
const SESSION_SUMMARY_COLLECTION_ID = process.env.APPWRITE_SESSION_SUMMARY_COLLECTION_ID!;
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID!;

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

    // First, find the user document
    const userDocs = await databases.listDocuments(
      DATABASE_ID,
      USERS_COLLECTION_ID,
      [Query.equal('authUserId', userId)]
    );

    if (userDocs.documents.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = userDocs.documents[0];

    // Build query for sessions
    const sessionQueries = [
      Query.equal('userId', userDoc.$id),
      Query.orderDesc('startTime'),
      Query.limit(200) // Fetch up to 200 sessions
    ];

    // Add date range filters if provided
    if (startDate) {
      sessionQueries.push(Query.greaterThanEqual('startTime', startDate));
    }
    if (endDate) {
      sessionQueries.push(Query.lessThanEqual('startTime', endDate));
    }

    // Fetch all sessions for the user
    const sessionsResponse = await databases.listDocuments(
      DATABASE_ID,
      SESSIONS_COLLECTION_ID,
      sessionQueries
    );

    if (sessionsResponse.documents.length === 0) {
      return NextResponse.json({ sessions: [], total: 0 });
    }

    // Get all session IDs
    const sessionIds = sessionsResponse.documents.map(session => session.$id);

    // Fetch ALL summaries in a SINGLE query using the IN operator
    // Split into chunks if there are too many IDs (Appwrite has a limit)
    const chunkSize = 50;
    const summaryPromises = [];
    
    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);
      summaryPromises.push(
        databases.listDocuments(
          DATABASE_ID,
          SESSION_SUMMARY_COLLECTION_ID,
          [
            Query.equal('session_id', chunk),
            Query.limit(chunkSize)
          ]
        )
      );
    }

    // Execute all summary queries in parallel
    const summaryResponses = await Promise.all(summaryPromises);
    
    // Combine all summaries into a single map
    const summaryMap = new Map();
    summaryResponses.forEach(response => {
      response.documents.forEach(summary => {
        summaryMap.set(summary.session_id, summary);
      });
    });

    // Transform sessions to calendar format with summaries
    const calendarSessions: CalendarSession[] = sessionsResponse.documents.map(session => {
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
      const summary = summaryMap.get(session.$id);
      const rmssd = summary?.rmssd_session_ms || 0;
      const hrvScore = summary?.hrv_score || null;
      
      return {
        id: session.$id,
        date,
        time,
        rmssd: Math.round(rmssd),
        durationMin,
        hrvScore: hrvScore !== null ? Math.round(hrvScore) : undefined,
        notes: summary ? `Session ${session.$id.slice(-4)}` : `Session ${session.$id.slice(-4)} (No data)`
      };
    });

    // Add response caching headers
    const headers = new Headers();
    headers.set('Cache-Control', 'private, max-age=60'); // Cache for 1 minute

    return NextResponse.json(
      { 
        sessions: calendarSessions, 
        total: sessionsResponse.total,
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
