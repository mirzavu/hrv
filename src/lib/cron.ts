/**
 * Cron job scheduler for background tasks
 * Only runs in server environment (Node.js)
 */

import cron from 'node-cron';
import { getAdminPb } from '@/lib/pbAdmin';
import { sendMorningReminder } from '@/lib/notifications';
import { toLocalDateString, getLocalDayStartUTC, DEFAULT_TIMEZONE } from '@/utils/dateUtils';

let cronJobsInitialized = false;

/**
 * Initialize all cron jobs
 * Should be called once on server startup (e.g. from instrumentation.ts or server entry)
 */
export const initializeCronJobs = () => {
  // Only run in server environment
  if (typeof window !== 'undefined') {
    return;
  }

  if (cronJobsInitialized) {
    console.log('[CRON] Cron jobs already initialized');
    return;
  }

  console.log('[CRON] Initializing cron jobs...');

  // ===========================================================================
  // 1. MORNING REMINDER JOB
  // Runs at minute 0 of every hour (e.g., 08:00, 09:00, 10:00...)
  // ===========================================================================
  cron.schedule('0 * * * *', async () => {
    console.log(`[CRON] ⏰ Running Hourly Reminder Check: ${new Date().toISOString()}`);
    await processMorningReminders();
  });

  console.log('[CRON] Cron jobs initialized successfully');
  cronJobsInitialized = true;
};

/**
 * Logic to find users who just woke up (it's 8 AM locally) and haven't measured yet.
 */
async function processMorningReminders() {
  try {
    const pb = await getAdminPb();

    // 1. Fetch all users (with valid FCM tokens)
    // Note: For massive scale, you would paginate this. For MVP, getting all is fine.
    const users = await pb.collection('users').getFullList({
      filter: 'fcm_token != ""', // Only users who can receive notifications
      fields: 'id, name, timezone, fcm_token'
    });

    if (users.length === 0) return;

    console.log(`[CRON] Checking ${users.length} users for morning reminders...`);

    const now = new Date();
    const TARGET_HOUR = 8; // 8 AM

    // 2. Iterate and Check Logic
    for (const user of users) {
      const userTimezone = user.timezone || DEFAULT_TIMEZONE;

      // A. Is it 8 AM in their timezone?
      // We use Intl API to get the hour in their specific zone
      let localHour: number;
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: userTimezone,
          hour: 'numeric',
          hour12: false
        }).formatToParts(now);
        const hourPart = parts.find(p => p.type === 'hour');
        localHour = hourPart ? parseInt(hourPart.value, 10) : -1;
      } catch (e) {
        console.warn(`[CRON] Invalid timezone for user ${user.id}: ${userTimezone}`);
        continue;
      }

      // If it's not the 8:00-8:59 window, skip
      // (Note: This simple check handles integer and half-hour timezones decently for hourly crons)
      if (localHour !== TARGET_HOUR) {
        continue;
      }

      // B. Have they measured TODAY?
      // Calculate "Start of Today" in their timezone, converted to UTC
      const localDateStr = toLocalDateString(now, userTimezone);
      const startOfLocalDayUTC = getLocalDayStartUTC(localDateStr, userTimezone);
      const filterDateStr = startOfLocalDayUTC.toISOString().replace('T', ' '); // PB format

      try {
        // Check for any session created after their local midnight
        const sessionsToday = await pb.collection('sessions').getList(1, 1, {
          filter: `user_id = "${user.id}" && startTime >= "${filterDateStr}"`,
          fields: 'id' // Optimized select
        });

        if (sessionsToday.totalItems > 0) {
          // User already measured! No reminder needed.
          // console.log(`[CRON] User ${user.name} already measured today.`);
          continue;
        }

        // C. Send Reminder
        console.log(`[CRON] 🚀 Sending Morning Reminder to ${user.name} (${userTimezone})`);
        await sendMorningReminder(user.id, user.name);

      } catch (err) {
        console.error(`[CRON] Failed to check sessions/send for ${user.id}`, err);
      }
    }

  } catch (error) {
    console.error('[CRON] ❌ Error in processMorningReminders:', error);
  }
}

export const areCronJobsInitialized = () => cronJobsInitialized;
