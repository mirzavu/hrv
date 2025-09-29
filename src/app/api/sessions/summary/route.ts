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
const SESSION_SUMMARY_COLLECTION_ID = process.env.APPWRITE_SESSION_SUMMARY_COLLECTION_ID!;

// GET /api/sessions/summary - Fetch session summary by session ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Fetch session summary
    const summaries = await databases.listDocuments(
      DATABASE_ID,
      SESSION_SUMMARY_COLLECTION_ID,
      [Query.equal('session_id', sessionId)]
    );

    if (summaries.documents.length === 0) {
      return NextResponse.json({ error: 'Session summary not found' }, { status: 404 });
    }

    const summary = summaries.documents[0];

    return NextResponse.json({
      summary,
      total: summaries.total
    });

  } catch (error: unknown) {
    console.error('Error fetching session summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
