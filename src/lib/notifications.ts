import { getAdminPb } from '@/lib/pbAdmin';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Singleton pattern)
if (!admin.apps.length) {
    try {
        // Option 1: Using Environment Variables (Best for security)
        // You need to stringify your service-account.json and put it in .env
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('🔥 [Notifications] Firebase Admin Initialized');
        } else {
            console.warn('⚠️ [Notifications] FIREBASE_SERVICE_ACCOUNT_JSON missing in .env');
        }
    } catch (e) {
        console.error('Failed to initialize Firebase:', e);
    }
}

interface NotificationPayload {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
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
            return { success: false, error: 'No token' };
        }

        // 2. Send via Firebase
        if (admin.apps.length) {
            await admin.messaging().send({
                token: token,
                notification: {
                    title,
                    body,
                },
                data: data || {},
                // Android specific config for priority
                android: {
                    priority: 'high',
                    notification: {
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    }
                },
                // iOS specific config
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                        }
                    }
                }
            });
            console.log(`🚀 [PUSH] Sent to ${user.email}`);
        } else {
            console.log(`📢 [MOCK PUSH] (Firebase not configured) To: ${user.email} | Msg: ${title}`);
        }

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
