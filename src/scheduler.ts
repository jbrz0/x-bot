import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import logger from './utils/logger';

logger.info('Local scheduler started.');

// --- Configuration ---
// TODO: Make this schedule configurable (e.g., via config.ts or env var)
// Example: Run every hour at the 5-minute mark
const CRON_SCHEDULE = '5 */8 * * *';

// Determine if running in simulate mode
const isSimulate = process.env.SIMULATE_MODE === 'true';
const simulateArg = isSimulate ? ' --simulate' : '';

// Path to the bot script
const botScriptPath = path.resolve(__dirname, 'bot.js');
const command = `node ${botScriptPath}${simulateArg}`;

/**
 * Executes the bot script using ts-node.
 */
function runBotScript() {
  logger.info(`Executing bot script: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      logger.error({ error, stderr }, `Error executing bot script`);
      return;
    }
    if (stderr) {
      logger.warn({ stderr }, 'Bot script produced stderr output');
    }
    logger.info({ stdout }, `Bot script finished successfully`);
  });
}

// Schedule the bot script execution
cron.schedule(CRON_SCHEDULE, () => {
  logger.info(`Cron job triggered (${CRON_SCHEDULE}). Running bot script...`);
  runBotScript();
});

logger.info(`Bot script scheduled to run with schedule: ${CRON_SCHEDULE}`);
if (isSimulate) {
  logger.warn('Scheduler running in SIMULATE mode. Bot script will run with --simulate flag.');
}

// Keep the scheduler running (useful for local dev)
// In a real deployment, the process manager (like PM2 or Docker) would handle this.
// For simple `npm run dev` with nodemon, this keeps the cron active.
logger.info('Scheduler process is running. Press Ctrl+C to exit.');
// This prevents the script from exiting immediately.
// Handle graceful shutdown if needed.
process.stdin.resume();

function handleExit(signal: string) {
  logger.info(`Received ${signal}. Shutting down scheduler...`);
  // Perform any cleanup here if necessary
  process.exit(0);
}

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM')); 