import logger from '../utils/logger';
import { config } from '../config'; // Import shared configuration
import prisma from '../lib/prisma'; // Import the Prisma client instance
import { searchRecentTweets } from '../services/xClient'; // Import the actual search function
// TODO: Import necessary types from twitter-api-v2 when implementing tweet fetching
// import { TTweetv2Tweet } from 'twitter-api-v2';

// --- Configuration (Now imported from config.ts) ---
const { topicWeights, engagement } = config;
const ENGAGEMENT_THRESHOLD = engagement.replyThreshold;
const HOURS_SINCE_LAST_REPLY_AUTHOR = engagement.hoursSinceLastReplyAuthor;

// --- Types --- (Define interfaces for clarity)

interface TweetCandidate {
  id: string;
  text: string;
  authorId: string;
  authorFollowers: number;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  quoteCount: number;
  createdAt: Date;
  // Add other relevant fields from Twitter API response if needed
}

interface ActionDecision {
  type: 'reply' | 'repost' | 'original_post' | 'ignore';
  reason: string;
  targetTweet?: TweetCandidate; // For replies/reposts
  content?: string; // For original posts (or pre-generated content)
}

// --- Helper Functions ---

/**
 * Checks if tweet text contains keywords related to configured topics.
 * @param text The text content of the tweet.
 * @returns True if relevant keywords are found, false otherwise.
 */
function isTweetRelevant(text: string): boolean {
  const lowerText = text.toLowerCase();
  for (const topic in config.topicKeywords) {
    const keywords = config.topicKeywords[topic as keyof typeof config.topicKeywords];
    if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
      return true;
    }
  }
  return false;
}

/**
 * Gets the current time window configuration based on the hour.
 * @param currentHour The current hour (0-23).
 * @returns The config object for the current window, or null if outside defined windows.
 */
function getCurrentCadenceWindow(currentHour: number): typeof config.cadence.morning | typeof config.cadence.afternoon | typeof config.cadence.evening | null {
  for (const windowKey in config.cadence) {
    const windowConfig = config.cadence[windowKey as keyof typeof config.cadence];
    if (currentHour >= windowConfig.startHour && currentHour < windowConfig.endHour) {
      return windowConfig;
    }
  }
  return null;
}

/**
 * Counts interactions of a specific type within a given time frame.
 * @param type The type of interaction ('reply', 'repost', 'original_post').
 * @param sinceDate The start date/time to count from.
 * @returns A promise resolving to the count of interactions.
 */
async function countRecentInteractions(type: string, sinceDate: Date): Promise<number> {
  if (config.simulateMode) {
    logger.warn(`[SIMULATE] DB count skipped for type ${type} since ${sinceDate.toISOString()}. Returning 0.`);
    return 0; // Assume no interactions in simulate mode
  }
  try {
    const count = await prisma.interactionLog.count({
      where: {
        type: type,
        createdAt: {
          gte: sinceDate,
        },
      },
    });
    logger.debug({ type, since: sinceDate.toISOString(), count }, 'Checked recent interaction count');
    return count;
  } catch (error) {
    logger.error({ error, type, sinceDate }, 'Error counting recent interactions');
    return Infinity; // Return Infinity on error to prevent actions if DB fails
  }
}

// --- Core Logic Functions ---

/**
 * Fetches recent tweets based on defined topics/keywords.
 * @returns A promise resolving to an array of potential TweetCandidates.
 */
async function fetchTweetCandidates(): Promise<TweetCandidate[]> {
  // Use the actual search function from xClient
  const candidates = await searchRecentTweets(20); // Fetch more candidates initially (e.g., 20)
  return candidates;
}

/**
 * Calculates an engagement score for a tweet candidate.
 * Formula: (author_followers ^ 0.5) * (like_count + retweet_count * 1.5) / tweet_age_minutes
 * @param tweet The TweetCandidate to score.
 * @returns The calculated engagement score.
 */
export function calculateEngagementScore(tweet: TweetCandidate): number {
  const ageMinutes = (Date.now() - tweet.createdAt.getTime()) / (1000 * 60);
  if (ageMinutes <= 0) return 0; // Avoid division by zero or negative age

  const score = (Math.sqrt(tweet.authorFollowers) * (tweet.likeCount + tweet.retweetCount * 1.5)) / ageMinutes;
  return score;
}

/**
 * Checks if the bot has replied to the author recently.
 * Placeholder - Needs actual implementation using Prisma.
 * @param authorId The ID of the tweet author.
 * @returns A promise resolving to true if a recent reply exists, false otherwise.
 */
async function hasRepliedToAuthorRecently(authorId: string): Promise<boolean> {
  const cutoffDate = new Date(Date.now() - HOURS_SINCE_LAST_REPLY_AUTHOR * 60 * 60 * 1000);
  logger.debug(`Checking for recent replies to author ${authorId} since ${cutoffDate.toISOString()}`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] DB check skipped for hasRepliedToAuthorRecently.`);
    return false; // Assume no recent reply in simulate mode for safety
  }

  try {
    const recentReply = await prisma.interactionLog.findFirst({
      where: {
        authorId: authorId,
        type: 'reply', // Only check for replies
        createdAt: {
          gte: cutoffDate, // Greater than or equal to the cutoff date
        },
      },
    });

    if (recentReply) {
      logger.info(`Found recent reply to author ${authorId} (ID: ${recentReply.id}). Skipping reply.`);
      return true;
    } else {
      logger.debug(`No recent reply found for author ${authorId}.`);
      return false;
    }
  } catch (error) {
    logger.error({ error, authorId }, 'Error checking for recent replies in database');
    // Default to true (don't reply) if there's a DB error to be safe
    return true; 
  }
}

/**
 * Analyzes tweet candidates and decides on the next action (reply, repost, original post, ignore).
 * Placeholder - Needs refinement with actual logic and integration.
 * @returns A promise resolving to an ActionDecision.
 */
export async function chooseNextAction(): Promise<ActionDecision> {
  logger.info('Choosing next action...');
  const candidates = await fetchTweetCandidates();
  candidates.sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));

  const now = new Date();
  const currentHour = now.getHours();
  const currentWindow = getCurrentCadenceWindow(currentHour);

  // Determine start time for cadence checks (e.g., start of the current window or last X hours)
  // Simple approach: check since the start of the current window
  let cadenceCheckStartDate = new Date(now);
  if (currentWindow) {
      cadenceCheckStartDate.setHours(currentWindow.startHour, 0, 0, 0);
  } else {
      // If outside defined windows, maybe check last 3 hours? Or don't act?
      // For now, let's default to not acting outside windows by setting a future date.
      cadenceCheckStartDate.setHours(currentHour + 1, 0, 0, 0); 
  }

  logger.debug({ currentHour, window: currentWindow, checkSince: cadenceCheckStartDate.toISOString() }, 'Cadence check parameters');

  // --- Action Logic ---

  // 1. Look for a high-engagement tweet to reply to (if cadence allows)
  const allowedReplies = currentWindow && 'replies' in currentWindow ? currentWindow.replies : 0;
  const recentReplyCount = await countRecentInteractions('reply', cadenceCheckStartDate);
  logger.debug({ allowed: allowedReplies, recent: recentReplyCount }, 'Reply cadence check');

  if (allowedReplies > 0 && recentReplyCount < allowedReplies) {
    for (const tweet of candidates) {
      const score = calculateEngagementScore(tweet);
      const repliedRecently = await hasRepliedToAuthorRecently(tweet.authorId);

      logger.debug({ tweetId: tweet.id, score, repliedRecently }, 'Evaluating candidate tweet for reply');

      if (score > ENGAGEMENT_THRESHOLD && !repliedRecently && isTweetRelevant(tweet.text)) {
        logger.info(`Found potential reply target: Tweet ${tweet.id} (Score: ${score.toFixed(2)}, Relevant: true)`);
        return {
          type: 'reply',
          reason: `High engagement score (${score.toFixed(2)}), relevant, within cadence (${recentReplyCount}/${allowedReplies}), and no recent reply to author.`,
          targetTweet: tweet,
        };
      }
    }
  } else {
      logger.info(`Skipping reply check due to cadence limits (allowed: ${allowedReplies}, recent: ${recentReplyCount}) or being outside a reply window.`);
  }

  // 2. Look for a relevant tweet to repost (if cadence allows)
  const allowedReposts = currentWindow && 'reposts' in currentWindow ? currentWindow.reposts : 0;
  const recentRepostCount = await countRecentInteractions('repost', cadenceCheckStartDate);
  logger.debug({ allowed: allowedReposts, recent: recentRepostCount }, 'Repost cadence check');

  if (allowedReposts > 0 && recentRepostCount < allowedReposts) {
    const relevantCandidates = candidates.filter(t => isTweetRelevant(t.text));
    if (relevantCandidates.length > 0) {
      const bestRepostCandidate = relevantCandidates[0]; 
       // TODO: Add check to ensure bot hasn't reposted this specific tweet recently
      logger.info(`Found potential repost target: Tweet ${bestRepostCandidate.id} (Score: ${calculateEngagementScore(bestRepostCandidate).toFixed(2)})`);
      return {
        type: 'repost',
        reason: `Found relevant candidate within cadence (${recentRepostCount}/${allowedReposts}).`,
        targetTweet: bestRepostCandidate,
      };
    }
  } else {
       logger.info(`Skipping repost check due to cadence limits (allowed: ${allowedReposts}, recent: ${recentRepostCount}) or being outside a repost window.`);
  }

  // 3. Decide to make an original post (if cadence allows)
  const allowedOriginals = currentWindow && 'original' in currentWindow ? currentWindow.original : 0;
  const recentOriginalCount = await countRecentInteractions('original_post', cadenceCheckStartDate);
   logger.debug({ allowed: allowedOriginals, recent: recentOriginalCount }, 'Original post cadence check');

  if (allowedOriginals > 0 && recentOriginalCount < allowedOriginals) {
     logger.info('Conditions met to generate an original post based on cadence.');
     return {
        type: 'original_post',
        reason: `Cadence allows original post (${recentOriginalCount}/${allowedOriginals}).`,
     };
  } else {
      logger.info(`Skipping original post check due to cadence limits (allowed: ${allowedOriginals}, recent: ${recentOriginalCount}) or being outside an original post window.`);
  }

  // 4. Default to ignoring
  logger.info('No suitable action found based on current candidates and cadence.');
  return {
    type: 'ignore',
    reason: 'No suitable candidates found or conditions met for other actions within cadence limits.',
  };
}

// TODO: Implement logic based on posting cadence (checking counts against DB logs)
// TODO: Refine decision logic (e.g., use OpenAI to assess relevance/value) 