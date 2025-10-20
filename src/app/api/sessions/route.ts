import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';

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

    const pb = await getAdminPb();
    
    // Convert offset/limit to page-based pagination
    const page = Math.floor(offset / limit) + 1;

    // Fetch user's sessions directly (userId is the PB record ID)
    const result = await pb.collection('sessions').getList(page, limit, {
      filter: `userId = "${userId}"`,
      sort: '-startTime',
    });

    // Map PB records to include $id for client compatibility
    const sessions = result.items.map(withDollarId);

    return NextResponse.json({
      sessions,
      total: result.totalItems,
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

// POST /api/sessions - Create a new HRV session (alternative to direct PB calls)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sessionData } = body;

    if (!userId || !sessionData) {
      return NextResponse.json({ error: 'User ID and session data are required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Validate user exists (userId is the PB record ID)
    try {
      await pb.collection('users').getOne(userId);
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create the session
    const session = await pb.collection('sessions').create({
      ...sessionData,
      userId: userId,
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ session: withDollarId(session) }, { status: 201 });

  } catch (error: unknown) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
