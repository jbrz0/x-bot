import dotenv from 'dotenv';
// Load .env file at the very top, before any other imports
dotenv.config(); 

import logger from './utils/logger';
import { chooseNextAction } from './strategies/chooseAction';
import { generateContent } from './services/openaiClient';
import { postTweet, replyToTweet, retweet, quoteTweet } from './services/xClient'; 
import { config } from './config';

// Function to log interactions (no database - just console logging)
async function logInteraction(type: string, targetId?: string, authorId?: string): Promise<void> {
  logger.info(`[NO-DB] Interaction logged: type=${type}, targetId=${targetId}, authorId=${authorId}`);
  // No database logging - just console output for tracking
}

/**
 * Main function to run the bot's logic cycle.
 * @param bypassCadence - If true, ignores cadence windows for immediate posting
 */
export async function runBotCycle(bypassCadence: boolean = false) {
  logger.info('Starting bot cycle...');

  try {
    const decision = await chooseNextAction(bypassCadence);
    logger.info(`Action decided: ${decision.type} - ${decision.reason}`);

    switch (decision.type) {
      case 'reply':
        if (!decision.targetTweet) {
          logger.error('Decision was \'reply\' but targetTweet was missing.');
          break;
        }
        // 1. Generate reply content using OpenAI
        const replyPrompt = `Reply to @${decision.targetTweet.authorId}:\n\n"${decision.targetTweet.text}"\n\nAdd value. Be brief and helpful.`;
        const replyContent = await generateContent(replyPrompt);

        if (!replyContent) {
          logger.error('Reply content generation failed or was flagged by safeguards.');
          break; // Skip to next cycle
        }

        // 2. Post the reply via xClient
        const replyResultId = await replyToTweet(replyContent, decision.targetTweet.id);
        
        // 3. Log reply interaction
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
        
        // 2. Log repost interaction
        if (retweetSuccess) {
             // Log with the ID of the *original* tweet that was retweeted
            await logInteraction('repost', decision.targetTweet.id);
        } else {
            logger.warn('Retweet was not successful, skipping interaction log.');
        }
        break;

      case 'quote_tweet':
        if (!decision.targetTweet) {
          logger.error('Decision was \'quote_tweet\' but targetTweet was missing.');
          break;
        }
        
        // 1. Generate quote tweet commentary using OpenAI
        const quoteTweetPrompt = `Quick comment on this tweet by @${decision.targetTweet.authorId}:\n\n"${decision.targetTweet.text}"\n\nAdd your take. Be brief and insightful.`;
        const quoteContent = await generateContent(quoteTweetPrompt);

        if (!quoteContent) {
          logger.error('Quote tweet content generation failed or was flagged by safeguards.');
          break; // Skip to next cycle
        }

        // 2. Post the quote tweet via xClient
        const quoteResultId = await quoteTweet(quoteContent, decision.targetTweet.id);
        
        // 3. Log quote_tweet interaction
        if (quoteResultId) {
            await logInteraction('quote_tweet', quoteResultId, decision.targetTweet.authorId);
        } else {
            logger.warn('Quote tweet was not successful, skipping interaction log.');
        }
        break;

      case 'original_post':
        // 1. Generate original post content using system prompt from config
        // Short, punchy prompts for concise content

        // removed prompts:
        // 'TypeScript/React learning from building.',
        const prompts = [
          'Quick UI/UX tip from your design experience.',
          'Productivity hack you actually use.',
          'AI tool impact on your workflow.',
          'Crypto UX observation.',
          'Minimalist design approach.',
          'Apple ecosystem workflow tip.',
          'Design systems insight.',
          'Indie hacker reality check.',
          'Tech optimism vs hype reality.'
        ];
        const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
        logger.debug({ selectedPrompt: randomPrompt }, 'Selected prompt for original post');
        const postContent = await generateContent(randomPrompt);

        if (!postContent) {
          logger.error('Original post content generation failed or was flagged by safeguards.');
          break; // Skip to next cycle
        }

        // 2. Post the tweet via xClient
        const postResultId = await postTweet(postContent);
        
        // 3. Log original_post interaction
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
// Run the bot when this file is executed directly
if (require.main === module) {
  logger.info('Running bot cycle directly...');
  
  runBotCycle(true) // Bypass cadence windows for immediate posting
    .then(async () => {
      logger.info('Bot execution completed successfully.');
      process.exit(0);
    })
    .catch(async (error) => {
      logger.fatal({ error }, 'Unhandled error during bot execution.');
      process.exit(1);
    });
}