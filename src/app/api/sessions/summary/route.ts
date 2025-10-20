import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';

// GET /api/sessions/summary - Fetch session summary by session ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Fetch session summary
    const result = await pb.collection('session_summary').getList(1, 1, {
      filter: `session_id = "${sessionId}"`
    });

    if (result.items.length === 0) {
      return NextResponse.json({ error: 'Session summary not found' }, { status: 404 });
    }

    const summary = withDollarId(result.items[0]);

    return NextResponse.json({
      summary,
      total: result.totalItems
    });

  } catch (error: unknown) {
    console.error('Error fetching session summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session summary', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
