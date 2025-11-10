import { NextRequest, NextResponse } from 'next/server';
import { createWeeklyBaselineSnapshots } from '@/utils/cron/baselineHistory';

/**
 * API route for weekly baseline history cron job
 * Should be called by cron scheduler every Monday at 00:00 UTC
 * 
 * Optional: Add authentication/secret check for security
 */
export async function GET(request: NextRequest) {
  try {
    // Optional: Check for cron secret in headers or query params
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If CRON_SECRET is set, require authentication
      const urlSecret = request.nextUrl.searchParams.get('secret');
      if (urlSecret !== cronSecret) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[CRON_API] Baseline history cron job triggered');
    const result = await createWeeklyBaselineSnapshots();

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully created ${result.snapshotsCreated} baseline snapshots`,
        snapshotsCreated: result.snapshotsCreated,
        errors: result.errors
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `Created ${result.snapshotsCreated} snapshots with ${result.errors.length} errors`,
        snapshotsCreated: result.snapshotsCreated,
        errors: result.errors
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[CRON_API] Error in baseline history cron job:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}

