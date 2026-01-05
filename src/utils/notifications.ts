/**
 * Notification utility functions
 * Creates notifications for various app events
 */

import { getAdminPb } from '@/lib/pbAdmin';

export type NotificationType = 'alert' | 'achievement' | 'info';

interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
}

/**
 * Create a notification for a user
 */
export const createNotification = async (params: CreateNotificationParams): Promise<boolean> => {
    try {
        const pb = await getAdminPb();
        await pb.collection('notifications').create({
            user_id: params.userId,
            type: params.type,
            title: params.title,
            message: params.message,
            read: false,
        });
        console.log(`[NOTIFICATION] Created notification for user ${params.userId}: ${params.title}`);
        return true;
    } catch (error) {
        console.error('[NOTIFICATION] Failed to create notification:', error);
        return false;
    }
};

/**
 * Create a streak milestone notification
 * Called when user reaches 7, 14, 21, 30 day streaks
 */
export const createStreakNotification = async (userId: string, uniqueDays: number): Promise<boolean> => {
    // Only create notification for milestone days
    const milestones = [7, 14, 21, 30];
    if (!milestones.includes(uniqueDays)) {
        return false;
    }

    return createNotification({
        userId,
        type: 'achievement',
        title: `${uniqueDays}-Day Tracking Streak!`,
        message: `Consistency is key! You've tracked your HRV for ${uniqueDays} days. Keep up the great work!`,
    });
};

/**
 * Create a baseline updated notification
 * Called when baseline is created or recalculated
 */
export const createBaselineUpdatedNotification = async (
    userId: string,
    isNewBaseline: boolean = false
): Promise<boolean> => {
    return createNotification({
        userId,
        type: 'info',
        title: isNewBaseline ? 'Baseline Established!' : 'Baseline Updated',
        message: isNewBaseline
            ? 'Your personal HRV baseline has been established! Future sessions will now be compared against this baseline.'
            : 'Your baseline has been recalculated based on your recent session data.',
    });
};

/**
 * Create an HRV alert notification
 * Called when HRV drops significantly below baseline
 */
export const createHRVAlertNotification = async (
    userId: string,
    percentChange: number
): Promise<boolean> => {
    return createNotification({
        userId,
        type: 'alert',
        title: 'HRV dropped significantly',
        message: `Your HRV is ${Math.abs(percentChange).toFixed(0)}% lower than your baseline. Consider a rest day or light recovery.`,
    });
};
