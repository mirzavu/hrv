import { getAdminPb } from '@/lib/pbAdmin';

interface NotificationPayload {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>; // Deep link data (e.g., { route: '/measure' })
}

/**
 * Sends a push notification to a specific user.
 * Currently allows you to 'dry run' the logic before connecting Firebase.
 */
export const sendPushNotification = async ({ userId, title, body, data }: NotificationPayload) => {
    try {
        const pb = await getAdminPb();

        // 1. Get User's Token
        const user = await pb.collection('users').getOne(userId);
        const token = user.fcm_token;

        if (!token) {
            console.warn(`🔕 [Notifications] User ${userId} has no registered device token.`);
            return { success: false, error: 'No token' };
        }

        // 2. Construct the Message (FCM Format)
        const message = {
            token: token,
            notification: {
                title,
                body,
            },
            data: data || {},
            // Android/iOS specific config can go here
        };

        // TODO: UNCOMMENT THIS WHEN FIREBASE ADMIN IS INSTALLED
        // import { getMessaging } from 'firebase-admin/messaging';
        // const response = await getMessaging().send(message);

        // For now, Mock it:
        console.log(`🚀 [MOCK PUSH] Sending to ${user.email} (${token.substring(0, 10)}...)`);
        console.log(`   Title: "${title}"`);
        console.log(`   Body: "${body}"`);

        return { success: true };

    } catch (error) {
        console.error(`❌ [Notifications] Failed to send to ${userId}:`, error);
        return { success: false, error };
    }
};

/**
 * Helper: Send a "Morning Readiness" Reminder
 */
export const sendMorningReminder = async (userId: string, userName: string) => {
    return sendPushNotification({
        userId,
        title: "Morning Readiness",
        body: `Good morning ${userName}! Measure your HRV now to unlock your daily score.`,
        data: { route: '/measure', type: 'morning_reminder' }
    });
};
