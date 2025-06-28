import logger from '../utils/logger';
import { config } from '../config'; // Import shared configuration
import prisma from '../lib/prisma'; // Import the Prisma client instance
import { searchRecentTweets } from '../services/xClient'; // Import the actual search function
import { Prisma } from '@prisma/client'; // Import Prisma for types
// TODO: Import necessary types from twitter-api-v2 when implementing tweet fetching
// import { TTweetv2Tweet } from 'twitter-api-v2';

// --- Configuration (Now imported from config.ts) ---
const { topicWeights, engagement } = config;
const ENGAGEMENT_THRESHOLD = engagement.replyThreshold;
const HOURS_SINCE_LAST_REPLY_AUTHOR = engagement.hoursSinceLastReplyAuthor;

// --- Twitter API Rate Limits (Basic Tier) ---
const TWITTER_POST_REPLY_LIMIT_24H = 100; // POST /2/tweets (User Limit)
const TWITTER_REPOST_LIMIT_15M = 5;     // POST /2/users/:id/retweets (User Limit)

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
async function countRecentInteractions(type: string | string[], sinceDate: Date): Promise<number> {
  const types = Array.isArray(type) ? type.join(', ') : type;
  logger.warn(`[NO-DB] Skipping database count for type(s) ${types}. Returning 0 to allow posting.`);
  return 0; // Always return 0 to allow posting since we're not using database
}

/**
 * Checks if the bot has reposted a specific tweet recently.
 * @param targetTweetId The ID of the tweet to check for reposts.
 * @returns A promise resolving to true if a recent repost exists, false otherwise.
 */
async function hasRepostedTweetRecently(targetTweetId: string): Promise<boolean> {
  logger.warn(`[NO-DB] Skipping repost check for tweet ${targetTweetId}. Allowing repost.`);
  return false; // Always allow reposts since we're not using database
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
 * @param authorId The ID of the tweet author.
 * @returns A promise resolving to true if a recent reply exists, false otherwise.
 */
async function hasRepliedToAuthorRecently(authorId: string): Promise<boolean> {
  logger.warn(`[NO-DB] Skipping reply check for author ${authorId}. Allowing reply.`);
  return false; // Always allow replies since we're not using database
}

/**
 * Analyzes tweet candidates and decides on the next action (reply, repost, original post, ignore).
 * Placeholder - Needs refinement with actual logic and integration.
 * @param bypassCadence - If true, ignores cadence windows and allows posting anytime
 * @returns A promise resolving to an ActionDecision.
 */
export async function chooseNextAction(bypassCadence: boolean = false): Promise<ActionDecision> {
  logger.info('Choosing next action...');

  // --- Pre-Action Rate Limit Checks ---
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

  // Check combined Post/Reply limit (24 hours)
  const recentPostsAndRepliesCount24h = await countRecentInteractions(['original_post', 'reply'], twentyFourHoursAgo);
  if (recentPostsAndRepliesCount24h >= TWITTER_POST_REPLY_LIMIT_24H) {
    logger.warn(`Approaching or exceeded 24-hour Post/Reply limit (${recentPostsAndRepliesCount24h}/${TWITTER_POST_REPLY_LIMIT_24H}). Holding off actions.`);
    return { type: 'ignore', reason: `24-hour Post/Reply limit reached (${recentPostsAndRepliesCount24h}/${TWITTER_POST_REPLY_LIMIT_24H})` };
  }
  logger.debug(`24h Post/Reply Count: ${recentPostsAndRepliesCount24h}/${TWITTER_POST_REPLY_LIMIT_24H}`);

  // Check Repost limit (15 minutes) - Note: This check is also implicitly done later, but checking early avoids unnecessary work
  const recentRepostsCount15m = await countRecentInteractions('repost', fifteenMinutesAgo);
  if (recentRepostsCount15m >= TWITTER_REPOST_LIMIT_15M) {
     logger.warn(`Approaching or exceeded 15-minute Repost limit (${recentRepostsCount15m}/${TWITTER_REPOST_LIMIT_15M}). Cannot repost currently.`);
     // We don't ignore *all* actions here, just reposting. The check below will handle this.
  }
   logger.debug(`15m Repost Count: ${recentRepostsCount15m}/${TWITTER_REPOST_LIMIT_15M}`);
  // --- End Pre-Action Rate Limit Checks ---

  // --- Cadence Window and Allowed Actions Check (NEW) ---
  const currentHour = now.getHours();
  const currentWindow = getCurrentCadenceWindow(currentHour);

  let allowedReplies = 0;
  let allowedReposts = 0;
  let allowedOriginals = 0;
  
  if (bypassCadence) {
    // Bypass cadence windows - allow all actions
    allowedReplies = 10;
    allowedReposts = 10;
    allowedOriginals = 10;
    logger.info('Bypassing cadence windows - all actions allowed.');
  } else if (currentWindow) {
    allowedReplies = 'replies' in currentWindow ? currentWindow.replies : 0;
    allowedReposts = 'reposts' in currentWindow ? currentWindow.reposts : 0;
    allowedOriginals = 'original' in currentWindow ? currentWindow.original : 0;
  }

  if (!bypassCadence && (!currentWindow || (allowedReplies === 0 && allowedReposts === 0 && allowedOriginals === 0))) {
    logger.info('No actions allowed in the current cadence window. Skipping candidate search to save API credits.');
    return {
      type: 'ignore',
      reason: 'No actions allowed in the current cadence window (all limits zero or outside window).',
    };
  }
  // --- End Cadence Window and Allowed Actions Check (NEW) ---

  // Determine start time for cadence checks (e.g., start of the current window or last X hours)
  // Simple approach: check since the start of the current window
  let cadenceCheckStartDate = new Date(now);
  if (bypassCadence) {
    // For bypass mode, check from 24 hours ago
    cadenceCheckStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (currentWindow) {
    cadenceCheckStartDate.setHours(currentWindow.startHour, 0, 0, 0);
  } else {
    // Fallback to current hour if no window
    cadenceCheckStartDate.setHours(currentHour, 0, 0, 0);
  }

  logger.debug({ currentHour, window: currentWindow, checkSince: cadenceCheckStartDate.toISOString() }, 'Cadence check parameters');

  // --- Fetch Candidates Only If Actions Are Possible ---
  const candidates = await fetchTweetCandidates();
  candidates.sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));

  // --- Action Logic ---

  // 1. Look for a high-engagement tweet to reply to (if cadence allows)
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

  // 2. Look for a relevant tweet to repost (if cadence allows AND 15m limit not hit)
  const recentRepostCountCadence = await countRecentInteractions('repost', cadenceCheckStartDate); // Renamed for clarity
  // Use the pre-checked 15m count for rate limit
  logger.debug({ allowedCadence: allowedReposts, recentCadence: recentRepostCountCadence, recent15m: recentRepostsCount15m }, 'Repost cadence and rate limit check');

  if (allowedReposts > 0 && recentRepostCountCadence < allowedReposts && recentRepostsCount15m < TWITTER_REPOST_LIMIT_15M) {
    const relevantCandidates = candidates.filter(t => isTweetRelevant(t.text));
    if (relevantCandidates.length > 0) {
      // Find the best candidate that hasn't been reposted recently
      for (const bestRepostCandidate of relevantCandidates) {
        const alreadyReposted = await hasRepostedTweetRecently(bestRepostCandidate.id);
        if (!alreadyReposted) {
           logger.info(`Found potential repost target: Tweet ${bestRepostCandidate.id} (Score: ${calculateEngagementScore(bestRepostCandidate).toFixed(2)})`);
            return {
                type: 'repost',
                reason: `Found relevant candidate within cadence (${recentRepostCountCadence}/${allowedReposts}) and 15m rate limit (${recentRepostsCount15m}/${TWITTER_REPOST_LIMIT_15M}). Not a duplicate repost.`,
                targetTweet: bestRepostCandidate,
            };
        } else {
            logger.debug(`Skipping repost of ${bestRepostCandidate.id} as it was reposted recently.`);
        }
      }
       logger.info('All relevant candidates have been reposted recently.');
    }
  } else {
       logger.info(`Skipping repost check due to cadence limits (allowed: ${allowedReposts}, recent: ${recentRepostCountCadence}), 15m rate limit (recent: ${recentRepostsCount15m}/${TWITTER_REPOST_LIMIT_15M}), or being outside a repost window.`);
  }

  // 3. Decide to make an original post (if cadence allows)
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