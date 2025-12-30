import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';

/**
 * GET /api/sessions/comparison
 * 
 * Fetches previous session summaries for comparison.
 * Returns all previous sessions (excluding crashes) for the user to do comparison in component.
 * 
 * Query params:
 * - userId: User ID (required)
 * - sessionId: Current session ID (optional - if provided, excludes it from results)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const pb = await getAdminPb();

    // Build filter
    let filter = `user_id = "${userId}"`;
    if (sessionId) {
      filter += ` && session_id != "${sessionId}"`;
    }

    // Fetch all previous session summaries (excluding crashes)
    const previousSessionsResponse = await pb.collection('session_summary').getFullList({
      filter,
      sort: '-session_date'
    });

    // Filter out crashes
    const validSessions = previousSessionsResponse
      .map(s => withDollarId(s))
      .filter(s => !s.is_crash);

    return NextResponse.json({
      previousSessions: validSessions,
      total: validSessions.length,
      isFirstSession: validSessions.length === 0
    });

  } catch (error: unknown) {
    console.error('Error fetching comparison sessions:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch comparison sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

