import dotenv from 'dotenv';
// Load environment variables early
dotenv.config();

import cron from 'node-cron';
import logger from './utils/logger';
import { config } from './config'; // Import config for SIMULATE_MODE
import { runBotCycle } from './bot'; // Import the main bot logic function

logger.info('Scheduler started.');

// --- Configuration ---
// Read schedule from environment variable or use default
const cronSchedule = process.env.CRON_SCHEDULE || '5 */8 * * *';

/**
 * Runs the main bot cycle and handles errors.
 */
async function scheduledTaskWrapper() {
  logger.info(`Cron job triggered (${cronSchedule}). Running bot cycle...`);
  try {
    // Directly call the imported bot logic
    await runBotCycle();
    logger.info('Bot cycle finished successfully.');
  } catch (error) {
    // Log any errors that occur within the bot cycle
    logger.error({ error }, 'Error during scheduled bot cycle');
  }
}

// Schedule the bot script execution
cron.schedule(cronSchedule, scheduledTaskWrapper);

logger.info(`Bot cycle scheduled to run with schedule: ${cronSchedule}`);
if (config.simulateMode) {
  logger.warn('Scheduler running in SIMULATE mode. Bot actions will be logged, not executed.');
}

// Keep the scheduler running (useful for local dev / non-managed environments)
logger.info('Scheduler process is running. Press Ctrl+C to exit.');
process.stdin.resume();

function handleExit(signal: string) {
  logger.info(`Received ${signal}. Shutting down scheduler...`);
  // Add potential cleanup tasks here
  cron.getTasks().forEach(task => task.stop()); // Stop scheduled tasks
  logger.info('Scheduled tasks stopped.');
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM')); 