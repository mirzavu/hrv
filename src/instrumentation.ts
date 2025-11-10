/**
 * Next.js instrumentation file
 * Runs once when the server starts (only in production/server environment)
 * Used to initialize cron jobs and other server-side setup
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run in Node.js runtime (server-side)
    const { initializeCronJobs } = await import('./lib/cron');
    initializeCronJobs();
  }
}

