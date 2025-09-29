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
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID!;

// GET /api/sessions - Fetch user's HRV sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

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

    // Fetch user's sessions
    const sessions = await databases.listDocuments(
      DATABASE_ID,
      SESSIONS_COLLECTION_ID,
      [
        Query.equal('userId', userDoc.$id),
        Query.orderDesc('startTime'),
        Query.limit(limit),
        Query.offset(offset)
      ]
    );

    return NextResponse.json({
      sessions: sessions.documents,
      total: sessions.total,
      limit,
      offset
    });

  } catch (error: unknown) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/sessions - Create a new HRV session (alternative to direct Appwrite calls)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sessionData } = body;

    if (!userId || !sessionData) {
      return NextResponse.json({ error: 'User ID and session data are required' }, { status: 400 });
    }

    // Find the user document
    const userDocs = await databases.listDocuments(
      DATABASE_ID,
      USERS_COLLECTION_ID,
      [Query.equal('authUserId', userId)]
    );

    if (userDocs.documents.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userDoc = userDocs.documents[0];

    // Create the session
    const session = await databases.createDocument(
      DATABASE_ID,
      SESSIONS_COLLECTION_ID,
      'unique()',
      {
        ...sessionData,
        userId: userDoc.$id,
        createdAt: new Date().toISOString()
      }
    );

    return NextResponse.json({ session }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
