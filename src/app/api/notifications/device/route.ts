import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, token, platform } = body; // platform: 'ios' | 'android'

        if (!userId || !token) {
            return NextResponse.json({ error: 'Missing userId or token' }, { status: 400 });
        }

        const pb = await getAdminPb();

        // 1. Update the user record with the new token
        // Note: In a production app with multi-device support, 
        // you would upsert into a 'devices' collection instead.
        await pb.collection('users').update(userId, {
            fcm_token: token,
            // You might also want to store 'last_device_platform': platform
        });

        console.log(`📱 [API] Device token registered for user ${userId} (${platform})`);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error registering device token:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
