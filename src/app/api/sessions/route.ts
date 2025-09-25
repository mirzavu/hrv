import { NextRequest, NextResponse } from 'next/server';
import { databases } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { DATABASE_ID, SESSIONS_COLLECTION_ID, USERS_COLLECTION_ID } from '@/types';

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
        Query.equal('user', userDoc.$id),
        Query.orderDesc('date'),
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

  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions', details: error.message },
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
        user: userDoc.$id,
        createdAt: new Date().toISOString()
      }
    );

    return NextResponse.json({ session }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session', details: error.message },
      { status: 500 }
    );
  }
}
