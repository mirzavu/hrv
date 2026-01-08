import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';

// GET /api/user/profile - Get user profile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Get user profile directly (userId is the PB record ID)
    try {
      const userProfile = await pb.collection('users').getOne(userId);
      return NextResponse.json({ profile: withDollarId(userProfile) });
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

  } catch (error: unknown) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/user/profile - Update user profile (full replacement)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, profileData } = body;

    if (!userId || !profileData) {
      return NextResponse.json({ error: 'User ID and profile data are required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Update user profile directly (userId is the PB record ID)
    try {
      const updatedProfile = await pb.collection('users').update(userId, {
        ...profileData,
        updatedAt: new Date().toISOString()
      });

      return NextResponse.json({ profile: withDollarId(updatedProfile) });
    } catch {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

  } catch (error: unknown) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/profile - Partial profile update with field whitelisting
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, updates } = body;

    if (!userId || !updates) {
      return NextResponse.json({ error: 'Missing userId or updates' }, { status: 400 });
    }

    // Whitelist allowed fields for security
    const ALLOWED_FIELDS = [
      'name', 'age', 'gender', 'weight', 'height',
      'purpose', 'timezone', 'profileCompleted'
    ];

    const sanitizedUpdates: Record<string, unknown> = {};

    for (const key of Object.keys(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const pb = await getAdminPb();

    const updatedUser = await pb.collection('users').update(userId, sanitizedUpdates);

    console.log(`✅ [API] User profile updated for ${userId}:`, Object.keys(sanitizedUpdates));

    return NextResponse.json({
      success: true,
      updatedProfile: {
        timezone: updatedUser.timezone,
        usage_phase: updatedUser.usage_phase,
        weight: updatedUser.weight
      }
    });

  } catch (error: unknown) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
