import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

// GET /api/notifications - Fetch user's notifications
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const pb = await getAdminPb();
        const notifications = await pb.collection('notifications').getList(1, 50, {
            filter: `user_id = "${userId}"`,
            sort: '-created',
        });

        return NextResponse.json({
            notifications: notifications.items.map(n => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                read: n.read || false,
                created: n.created,
            })),
            totalItems: notifications.totalItems,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}

// DELETE /api/notifications - Delete all notifications for user
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const pb = await getAdminPb();
        // Fetch all notifications for this user
        const notifications = await pb.collection('notifications').getFullList({
            filter: `user_id = "${userId}"`,
        });

        // Delete each notification
        for (const notification of notifications) {
            await pb.collection('notifications').delete(notification.id);
        }

        return NextResponse.json({
            success: true,
            deleted: notifications.length
        });
    } catch (error) {
        console.error('Error deleting notifications:', error);
        return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
    }
}

// PATCH /api/notifications - Mark all as read
export async function PATCH(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const pb = await getAdminPb();
        // Fetch all unread notifications for this user
        const notifications = await pb.collection('notifications').getFullList({
            filter: `user_id = "${userId}" && read = false`,
        });

        // Mark each as read
        for (const notification of notifications) {
            await pb.collection('notifications').update(notification.id, { read: true });
        }

        return NextResponse.json({
            success: true,
            updated: notifications.length
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
    }
}
