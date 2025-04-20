import type { VercelRequest, VercelResponse } from '@vercel/node';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables relative to the project root
// Vercel typically handles env vars, but this helps ensure consistency
dotenv.config({ path: path.resolve(__dirname, '../../.env') }); 

// We need a way to log from the serverless function. 
// Using console.log/error initially, can integrate Pino later if needed.

/**
 * Vercel Serverless Function handler to trigger the bot script.
 */
export default function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  console.log('Vercel cron job triggered. Attempting to run bot script...');

  // Security: Check Vercel's cron secret if provided
  const cronSecret = process.env.VERCEL_CRON_SECRET;
  if (cronSecret) {
    const requestSecret = request.headers['authorization']?.split(' ')[1];
    if (requestSecret !== cronSecret) {
      console.error('Unauthorized cron request.');
      response.status(401).send('Unauthorized');
      return;
    }
    console.log('Vercel cron secret verified.');
  } else {
    console.warn('VERCEL_CRON_SECRET not set. Skipping verification (less secure).');
  }

  // Determine if running in simulate mode (can be set via Vercel env vars)
  const isSimulate = process.env.SIMULATE_MODE === 'true';
  const simulateArg = isSimulate ? ' --simulate' : '';

  // Path to the compiled bot script (assuming 'tsc' puts it in 'dist')
  // We use the compiled JS file here, not the TS file
  const botScriptPath = path.resolve(__dirname, '../../dist/bot.js'); 
  const command = `node ${botScriptPath}${simulateArg}`;

  console.log(`Executing bot script: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing bot script: ${error.message}`);
      console.error(`stderr: ${stderr}`);
      // Respond after attempting execution, even if there's an error
      response.status(500).json({ 
        status: 'Error executing bot script', 
        error: error.message, 
        stderr 
      });
      return;
    }
    if (stderr) {
      console.warn(`Bot script stderr: ${stderr}`);
    }
    console.log(`Bot script stdout: ${stdout}`);
    response.status(200).json({ 
      status: 'Bot script executed successfully', 
      stdout, 
      stderr 
    });
  });
} 