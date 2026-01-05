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

  // (Removed weekly baseline cron - now handled via event trigger in autoCheckAndUpdateBaseline)

  console.log('[CRON] Cron jobs initialized successfully');

  cronJobsInitialized = true;
};

/**
 * Check if cron jobs are initialized
 */
export const areCronJobsInitialized = () => cronJobsInitialized;

