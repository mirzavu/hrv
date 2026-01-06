import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';
import { formatDateForPocketBase } from '@/utils/dateUtils';

/**
 * GET /api/sessions/comparison
 * 
 * Fetches previous session summaries for comparison.
 * Returns all previous sessions (excluding crashes) for the user to do comparison in component.
 * 
 * Query params:
 * - userId: User ID (required)
 * - sessionId: Current session ID (optional - if provided, excludes it from results)
 * - referenceDate: ISO date string (optional - if provided, only returns sessions BEFORE this date)
 *                  Used for historical session viewing to compute comparisons relative to session's own date
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');
    const referenceDate = searchParams.get('referenceDate');

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
    // If referenceDate provided, only get sessions before that date (for historical comparison)
    if (referenceDate) {
      // Format the date for PocketBase comparison (use space instead of T)
      const pbDate = formatDateForPocketBase(referenceDate);
      filter += ` && session_date < "${pbDate}"`;
      console.log(`[Comparison API] Filtering sessions before ${referenceDate} (PB format: ${pbDate})`);
    }

    // Fetch all previous session summaries (excluding crashes)
    const previousSessionsResponse = await pb.collection('session_summary').getFullList({
      filter,
      sort: '-session_date'
    });

    console.log(`[Comparison API] Found ${previousSessionsResponse.length} sessions before referenceDate`);

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

