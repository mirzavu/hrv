import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';
import type { UserBaseline, SessionSummaryRecord } from '@/types';
import { calculateBaselineMetrics, canEstablishBaseline, hasValidTemporalDistribution } from '@/utils/baselineCalculations';

/**
 * GET /api/user/baseline?userId=xxx
 * Fetch user's baseline metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Fetch user's baseline (if exists)
    try {
      const baseline = await pb.collection('user_baselines').getFirstListItem(
        `user_id = "${userId}"`
      );
      
      return NextResponse.json({ baseline: withDollarId(baseline) });
    } catch (error: any) {
      // If baseline doesn't exist (404), return null
      if (error.status === 404) {
        return NextResponse.json({ baseline: null });
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error('Error fetching user baseline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch baseline', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/baseline
 * Calculate and update user's baseline from recent sessions
 * 
 * Body: {
 *   userId: string,
 *   sessionCount?: number (default: 14, how many recent sessions to use)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sessionCount = 14 } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Validate user exists
    try {
      await pb.collection('users').getOne(userId);
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch user's most recent sessions with summaries
    const sessions = await pb.collection('sessions').getList(1, sessionCount, {
      filter: `userId = "${userId}"`,
      sort: '-startTime'
    });

    if (sessions.items.length === 0) {
      return NextResponse.json({ 
        error: 'No sessions found',
        message: 'User has no sessions to calculate baseline from'
      }, { status: 400 });
    }

    // Fetch session summaries for these sessions
    const sessionIds = sessions.items.map(s => s.id);
    const summaryPromises = sessionIds.map(id =>
      pb.collection('session_summary').getFirstListItem(`session_id = "${id}"`)
        .catch(() => null) // Skip sessions without summaries
    );

    const summaries = (await Promise.all(summaryPromises))
      .filter((s): s is any => s !== null)
      .map(s => ({
        ...withDollarId(s),
        // Map PocketBase fields to SessionSummaryRecord format
      })) as SessionSummaryRecord[];

    if (summaries.length < 7) {
      return NextResponse.json({
        error: 'Insufficient sessions',
        message: `Need at least 7 sessions with complete data. Found ${summaries.length}.`,
        sessionsCount: summaries.length
      }, { status: 400 });
    }

    // Check temporal distribution
    const temporalCheck = hasValidTemporalDistribution(summaries);
    if (!temporalCheck.valid) {
      return NextResponse.json({
        error: 'Invalid temporal distribution',
        message: `Sessions must be spread across at least 5 different days spanning at least 5 days. Current: ${temporalCheck.uniqueDays} unique days over ${Math.round(temporalCheck.timeSpanDays)} days.`,
        sessionsCount: summaries.length,
        uniqueDays: temporalCheck.uniqueDays,
        timeSpanDays: temporalCheck.timeSpanDays
      }, { status: 400 });
    }

    // Calculate baseline metrics from sessions
    const baselineMetrics = calculateBaselineMetrics(summaries);

    if (baselineMetrics.rmssd_avg === null) {
      return NextResponse.json({
        error: 'Cannot establish baseline',
        message: 'Not enough valid session data to calculate baseline'
      }, { status: 400 });
    }

    const currentTime = new Date().toISOString();

    // Check if user already has a baseline record
    let existingBaseline: any = null;
    try {
      existingBaseline = await pb.collection('user_baselines').getFirstListItem(
        `user_id = "${userId}"`
      );
    } catch (error: any) {
      // 404 is expected if no baseline exists yet
      if (error.status !== 404) {
        throw error;
      }
    }

    let baseline: any;

    if (existingBaseline) {
      // Update existing baseline
      baseline = await pb.collection('user_baselines').update(existingBaseline.id, {
        ...baselineMetrics,
        sessions_count: summaries.length,
        established: canEstablishBaseline(summaries.length),
        last_updated: currentTime
      });
    } else {
      // Create new baseline
      baseline = await pb.collection('user_baselines').create({
        user_id: userId,
        ...baselineMetrics,
        sessions_count: summaries.length,
        established: canEstablishBaseline(summaries.length),
        last_updated: currentTime
      });
    }

    return NextResponse.json({
      baseline: withDollarId(baseline),
      message: existingBaseline ? 'Baseline updated successfully' : 'Baseline created successfully',
      sessionsUsed: summaries.length
    });

  } catch (error: unknown) {
    console.error('Error calculating/updating baseline:', error);
    return NextResponse.json(
      { error: 'Failed to update baseline', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/baseline?userId=xxx
 * Delete user's baseline (useful for resetting)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Find and delete user's baseline
    try {
      const baseline = await pb.collection('user_baselines').getFirstListItem(
        `user_id = "${userId}"`
      );
      
      await pb.collection('user_baselines').delete(baseline.id);
      
      return NextResponse.json({ 
        message: 'Baseline deleted successfully' 
      });
    } catch (error: any) {
      if (error.status === 404) {
        return NextResponse.json({ 
          message: 'No baseline found to delete' 
        });
      }
      throw error;
    }
  } catch (error: unknown) {
    console.error('Error deleting baseline:', error);
    return NextResponse.json(
      { error: 'Failed to delete baseline', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

