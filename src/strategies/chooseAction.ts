import logger from '../utils/logger';
import { config } from '../config'; // Import shared configuration
import { searchRecentTweets } from '../services/xClient'; // Import the actual search function

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
  type: 'reply' | 'repost' | 'quote_tweet' | 'original_post' | 'ignore';
  reason: string;
  targetTweet?: TweetCandidate; // For replies/reposts/quote tweets
  content?: string; // For original posts or quote tweet commentary
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
  const now = new Date();
  const currentHour = now.getHours();
  const currentWindow = getCurrentCadenceWindow(currentHour);

  // If not bypassing, and we're outside a defined window, do nothing.
  if (!bypassCadence && !currentWindow) {
    return { type: 'ignore', reason: 'Outside of defined cadence windows.' };
  }
  
  if (bypassCadence) {
    logger.info('Bypassing cadence windows - all actions allowed.');
  }

  // --- Fetch all potential candidates first to avoid multiple API calls ---
  logger.info('Fetching tweet candidates for all possible actions...');
  const allCandidates = await fetchTweetCandidates();
  const relevantCandidates = allCandidates.filter(t => isTweetRelevant(t.text));
  logger.info(`Found ${allCandidates.length} total candidates, ${relevantCandidates.length} are relevant.`);

  // --- Determine which actions are possible based on cadence and candidates, then add to a pool ---
  const possibleActions: Omit<ActionDecision, 'reason'>[] = [];
  const cadenceCheckStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Check over the last 24 hours

  // 1. Check for Original Post & Quote Tweet
  // Use optional chaining `?.` because `original` might not exist on all window types.
  const allowedOriginals = (bypassCadence ? 1 : (currentWindow && 'original' in currentWindow) ? currentWindow.original : 0);
  const recentOriginalCount = await countRecentInteractions(['original_post', 'quote_tweet'], cadenceCheckStartDate);
  
  if (allowedOriginals > 0 && recentOriginalCount < allowedOriginals) {
    // It's possible to create an original post.
    possibleActions.push({ type: 'original_post' });
    
    // It's also possible to do a quote tweet if we have a good candidate.
    if (relevantCandidates.length > 0) {
      const bestQuoteCandidate = [...relevantCandidates].sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a))[0];
      // We add this as another distinct possibility to the pool.
      possibleActions.push({ type: 'quote_tweet', targetTweet: bestQuoteCandidate });
    }
  } else if (allowedOriginals > 0) {
    logger.info(`Original content not posted due to cadence (allowed: ${allowedOriginals}, recent: ${recentOriginalCount}).`);
  }

  // 2. Check for Repost
  // Use optional chaining `?.` because `reposts` might not exist on all window types.
  const allowedReposts = (bypassCadence ? 1 : (currentWindow && 'reposts' in currentWindow) ? currentWindow.reposts : 0);
  if (allowedReposts > 0) {
    const recentRepostCountCadence = await countRecentInteractions('repost', cadenceCheckStartDate);
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const recentRepostsCount15m = await countRecentInteractions('repost', fifteenMinutesAgo);

    if (recentRepostCountCadence < allowedReposts && recentRepostsCount15m < TWITTER_REPOST_LIMIT_15M) {
      const sortedRelevant = [...relevantCandidates].sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));
      for (const candidate of sortedRelevant) {
        if (!await hasRepostedTweetRecently(candidate.id)) {
          possibleActions.push({ type: 'repost', targetTweet: candidate });
          break; // Add one valid repost candidate and stop.
        }
      }
    } else {
      logger.info(`Reposting not allowed due to cadence (allowed: ${allowedReposts}, recent: ${recentRepostCountCadence}) or 15m rate limit (recent: ${recentRepostsCount15m}).`);
    }
  }
  
  // 3. Check for Reply
  // Use optional chaining `?.` because `replies` might not exist on all window types.
  const allowedReplies = (bypassCadence ? 1 : (currentWindow && 'replies' in currentWindow) ? currentWindow.replies : 0);
  if (allowedReplies > 0) {
    const recentReplyCount = await countRecentInteractions('reply', cadenceCheckStartDate);
    if (recentReplyCount < allowedReplies) {
      const replyCandidates = allCandidates
        .filter((t: TweetCandidate) => calculateEngagementScore(t) > ENGAGEMENT_THRESHOLD)
        .sort((a: TweetCandidate, b: TweetCandidate) => calculateEngagementScore(b) - calculateEngagementScore(a));

      for (const candidate of replyCandidates) {
        if (!await hasRepliedToAuthorRecently(candidate.authorId)) {
          possibleActions.push({ type: 'reply', targetTweet: candidate });
          break; // Add one valid reply candidate and stop.
        }
      }
    } else {
       logger.info(`Replying not allowed due to cadence (allowed: ${allowedReplies}, recent: ${recentReplyCount}).`);
    }
  }

  // --- Make the final decision from the pool of possible actions ---
  if (possibleActions.length === 0) {
    logger.info('No suitable actions found based on current candidates and cadence.');
    return { type: 'ignore', reason: 'No valid actions available.' };
  }

  // Randomly select one of the possible actions
  const randomIndex = Math.floor(Math.random() * possibleActions.length);
  const chosenAction = possibleActions[randomIndex];
  
  const reason = `Randomly selected '${chosenAction.type}' from a pool of ${possibleActions.length} possible actions.`;
  logger.info({ chosenAction: chosenAction.type, reason, pool: possibleActions.map(p => p.type) }, 'Action decided.');

  return { ...chosenAction, reason };
}

// TODO: Implement logic based on posting cadence (checking counts against DB logs)
// TODO: Refine decision logic (e.g., use OpenAI to assess relevance/value)