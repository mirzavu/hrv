import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

/**
 * POST /api/user/timezone
 * 
 * Updates the user's timezone setting
 * 
 * Body: { userId: string, timezone: string }
 */
export async function POST(request: NextRequest) {
    try {
        const { userId, timezone } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        if (!timezone) {
            return NextResponse.json({ error: 'Timezone is required' }, { status: 400 });
        }

        // Validate timezone is a valid IANA timezone
        try {
            Intl.DateTimeFormat(undefined, { timeZone: timezone });
        } catch {
            return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
        }

        const pb = await getAdminPb();

        // Update user's timezone
        await pb.collection('users').update(userId, {
            timezone: timezone,
        });

        console.log(`[User Timezone] Updated timezone for user ${userId} to ${timezone}`);

        return NextResponse.json({ success: true, timezone });

    } catch (error: unknown) {
        console.error('Error updating user timezone:', error);
        return NextResponse.json(
            { error: 'Failed to update timezone', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
