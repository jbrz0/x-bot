import dotenv from 'dotenv';
// Load .env file at the very top, before any other imports
dotenv.config(); 

import logger from './utils/logger';
import { chooseNextAction } from './strategies/chooseAction';
import { generateContent } from './services/openaiClient';
// Import specific functions from xClient
import { postTweet, replyToTweet, retweet } from './services/xClient'; 
import prisma from './lib/prisma'; // Import the Prisma client instance
import { config } from './config';
// TODO: Import Prisma client and log interactions
// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// Function to log interactions to the database
async function logInteraction(type: string, targetId?: string, authorId?: string): Promise<void> {
  if (config.simulateMode) {
    logger.warn(`[SIMULATE] Would log interaction: type=${type}, targetId=${targetId}, authorId=${authorId}`);
    return;
  }
  try {
    await prisma.interactionLog.create({
      data: {
        type,
        targetId,
        authorId,
      },
    });
    logger.debug({ type, targetId, authorId }, 'Interaction logged to database');
  } catch (error) {
    logger.error({ error, type, targetId, authorId }, 'Failed to log interaction to database');
    // Continue execution even if logging fails
  }
}

/**
 * Main function to run the bot's logic cycle.
 */
async function runBotCycle() {
  logger.info('Starting bot cycle...');

  try {
    const decision = await chooseNextAction();
    logger.info(`Action decided: ${decision.type} - ${decision.reason}`);

    switch (decision.type) {
      case 'reply':
        if (!decision.targetTweet) {
          logger.error('Decision was \'reply\' but targetTweet was missing.');
          break;
        }
        // 1. Generate reply content using OpenAI
        const replyPrompt = `Draft a smart, value-adding reply to this tweet by @${decision.targetTweet.authorId} (followers: ${decision.targetTweet.authorFollowers}):\n\n"${decision.targetTweet.text}"\n\nKeep it concise and in the bot's persona.`;
        const replyContent = await generateContent(replyPrompt);

        if (!replyContent) {
          logger.error('Reply content generation failed or was flagged by safeguards.');
          break; // Skip to next cycle
        }

        // 2. Post the reply via xClient
        const replyResultId = await replyToTweet(replyContent, decision.targetTweet.id);
        
        // 3. Log reply interaction to Prisma
        if (replyResultId) {
             // Log with the ID of the *reply* tweet itself
            await logInteraction('reply', replyResultId, decision.targetTweet.authorId);
        } else {
             logger.warn('Reply was not successful, skipping interaction log.');
        }
        break;

      case 'repost':
        if (!decision.targetTweet) {
          logger.error('Decision was \'repost\' but targetTweet was missing.');
          break;
        }
        // 1. Retweet using xClient
        const retweetSuccess = await retweet(decision.targetTweet.id);
        
        // 2. Log repost interaction to Prisma
        if (retweetSuccess) {
             // Log with the ID of the *original* tweet that was retweeted
            await logInteraction('repost', decision.targetTweet.id);
        } else {
            logger.warn('Retweet was not successful, skipping interaction log.');
        }
        break;

      case 'original_post':
        // 1. Generate original post content
        const originalPostPrompt = 'Write a short, insightful tweet about productivity or UI/UX design in the bot\'s persona.';
        const postContent = await generateContent(originalPostPrompt);

        if (!postContent) {
          logger.error('Original post content generation failed or was flagged by safeguards.');
          break; // Skip to next cycle
        }

        // 2. Post the tweet via xClient
        const postResultId = await postTweet(postContent);
        
        // 3. Log original_post interaction to Prisma
        if (postResultId) {
            await logInteraction('original_post', postResultId);
        } else {
             logger.warn('Original post was not successful, skipping interaction log.');
        }
        break;

      case 'ignore':
        logger.info('No action taken based on current strategy.');
        break;

      default:
        logger.warn(`Unhandled decision type: ${(decision as any).type}`);
    }

  } catch (error) {
    logger.error({ error }, 'Error during bot cycle');
  }

  logger.info('Bot cycle finished.');
}

// --- Entry Point --- 

// Check for simulate mode flag (simple check for now)
const isSimulate = process.argv.includes('--simulate') || process.env.SIMULATE_MODE === 'true';

if (isSimulate) {
  logger.warn('Running in SIMULATE mode. No actual API calls will be made.');
  process.env.SIMULATE_MODE = 'true'; // Ensure it's set for downstream checks
}

// Run the main logic
runBotCycle()
  .then(async () => { // Make handler async
    logger.info('Bot execution completed successfully.');
    await prisma.$disconnect(); // Disconnect Prisma client
    process.exit(0);
  })
  .catch(async (error) => { // Make handler async
    logger.fatal({ error }, 'Unhandled error during bot execution.');
    await prisma.$disconnect(); // Disconnect Prisma client
    process.exit(1);
  }); 