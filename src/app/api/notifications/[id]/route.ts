import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PATCH /api/notifications/[id] - Mark single notification as read
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const pb = await getAdminPb();

        await pb.collection('notifications').update(id, { read: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating notification:', error);
        return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
    }
}

// DELETE /api/notifications/[id] - Delete single notification
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const pb = await getAdminPb();

        await pb.collection('notifications').delete(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting notification:', error);
        return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 });
    }
}
