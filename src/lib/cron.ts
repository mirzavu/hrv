/**
 * Cron job scheduler for background tasks
 * Only runs in server environment (Node.js), not in browser
 */

import cron from 'node-cron';

let cronJobsInitialized = false;

/**
 * Initialize all cron jobs
 * Should be called once on server startup
 */
export const initializeCronJobs = () => {
  // Only run in server environment (Node.js)
  if (typeof window !== 'undefined') {
    console.log('[CRON] Skipping cron initialization - running in browser');
    return;
  }

  if (cronJobsInitialized) {
    console.log('[CRON] Cron jobs already initialized');
    return;
  }

  console.log('[CRON] Initializing cron jobs...');

  // Schedule weekly baseline history snapshot
  // Runs every Monday at 00:00 UTC
  // Cron format: minute hour day-of-month month day-of-week
  // 0 0 * * 1 = Every Monday at 00:00
  cron.schedule('0 0 * * 1', async () => {
    console.log('[CRON] Weekly baseline history job triggered');
    try {
      // Call the API route internally
      // Call the utility function directly instead of HTTP request
      // This avoids HTTP overhead and works better in serverless environments
      const { createWeeklyBaselineSnapshots } = await import('@/utils/cron/baselineHistory');
      const result = await createWeeklyBaselineSnapshots();

      console.log('[CRON] Baseline history job completed:', result);

      // Return early - no HTTP call needed
      return;

    } catch (error: any) {
      console.error('[CRON] Error executing baseline history job:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[CRON] Cron jobs initialized successfully');
  console.log('[CRON] - Weekly baseline history: Every Monday at 00:00 UTC');

  cronJobsInitialized = true;
};

/**
 * Check if cron jobs are initialized
 */
export const areCronJobsInitialized = () => cronJobsInitialized;

