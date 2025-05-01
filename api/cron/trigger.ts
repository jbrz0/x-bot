import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runBotCycle } from '../../src/bot'; // Adjust path based on actual structure
import logger from '../../src/utils/logger'; // Adjust path

// This function is the entry point for the Vercel Serverless Function
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Optional: Add security check (e.g., check for a secret header)
  // if (request.headers['x-vercel-cron-secret'] !== process.env.VERCEL_CRON_SECRET) {
  //   logger.warn('Unauthorized cron access attempt');
  //   return response.status(401).send('Unauthorized');
  // }

  logger.info('Vercel Cron Job triggered. Running bot cycle...');

  try {
    await runBotCycle();
    logger.info('Bot cycle finished successfully via Vercel Cron.');
    // Send a success response back to Vercel
    response.status(200).send('Bot cycle completed successfully.');
  } catch (error) {
    logger.error({ error }, 'Error during Vercel Cron bot cycle');
    // Send an error response back to Vercel
    response.status(500).send('Error during bot cycle execution.');
  }
} 