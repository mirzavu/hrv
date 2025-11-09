import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import type { UserBaseline } from '@/types';

// GET /api/user/baseline - Get user baseline
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();
    
    // Get user baseline
    try {
      const baseline = await pb.collection('user_baselines').getFirstListItem(
        `user_id = "${userId}"`
      );
      
      // Map to UserBaseline format
      const mappedBaseline: UserBaseline = {
        $id: baseline.id,
        user_id: baseline.user_id,
        rmssd_avg: baseline.rmssd_avg,
        rmssd_stdev: baseline.rmssd_stdev,
        sdnn_avg: baseline.sdnn_avg,
        sdnn_stdev: baseline.sdnn_stdev,
        hr_avg: baseline.hr_avg,
        hr_stdev: baseline.hr_stdev,
        sd1_sd2_ratio_avg: baseline.sd1_sd2_ratio_avg,
        sd1_sd2_ratio_stdev: baseline.sd1_sd2_ratio_stdev,
        sessions_count: baseline.sessions_count,
        established: baseline.established,
        last_updated: baseline.last_updated,
        createdAt: baseline.created || baseline.createdAt
      };
      
      return NextResponse.json({ baseline: mappedBaseline });
    } catch (error: any) {
      // Baseline doesn't exist yet (404) - return null
      if (error.status === 404) {
        return NextResponse.json({ baseline: null });
      }
      throw error;
    }

  } catch (error: unknown) {
    console.error('Error fetching user baseline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user baseline', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
