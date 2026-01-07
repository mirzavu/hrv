import { NextRequest, NextResponse } from 'next/server';
// import { createWeeklyBaselineSnapshots } from '@/utils/cron/baselineHistory';

/**
 * API route for weekly baseline history cron job
 * DEPRECATED: Underlying utility was removed.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: 'This cron job is deprecated and no longer functional.'
  }, { status: 410 }); // 410 Gone
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
