import { TwitterApi, TweetV2, UserV2, ETwitterStreamEvent } from 'twitter-api-v2';
// Use dynamic import for p-retry (ESM module)
// import pRetry from 'p-retry'; 
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { config } from '../config';

// Define the structure we expect for user data in expansions
interface ExpandedUser extends UserV2 {
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
}

// Define the structure for tweet candidates used internally
// Duplicates the one in chooseAction.ts - consider moving to a shared types file
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
}

dotenv.config();

const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

// Check credentials
if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  const errorMsg = 'Missing X API credentials in environment variables.';
  // Log the error always
  logger.error(errorMsg);
  // Only exit if not in test environment
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
  // During tests, we allow execution to continue with potentially empty credentials,
  // relying on mocks to prevent actual API calls.
}

// Initialize client with user context
const twitterClientV2 = new TwitterApi({
  // Use dummy values during tests, actual values from env otherwise
  appKey: X_APP_KEY || (process.env.NODE_ENV === 'test' ? 'test_app_key' : ''), 
  appSecret: X_APP_SECRET || (process.env.NODE_ENV === 'test' ? 'test_app_secret' : ''),
  accessToken: X_ACCESS_TOKEN || (process.env.NODE_ENV === 'test' ? 'test_access_token' : ''),
  accessSecret: X_ACCESS_SECRET || (process.env.NODE_ENV === 'test' ? 'test_access_secret' : ''),
}).v2; // Get the v2 client instance

const xClient = twitterClientV2.readWrite; // Use readWrite for actions

logger.info('X API v2 client initialized.');

// --- Helper Function for Error Handling & Retries ---

/**
 * Wraps Twitter API calls with robust error handling, rate limit management, 
 * and exponential backoff retries using the p-retry library.
 */
async function handleApiRequest<T>(
  requestFn: () => Promise<T>,
  actionName: string
): Promise<T | null> {

  // Dynamically import p-retry
  const pRetry = (await import('p-retry')).default;

  const run = async () => {
    return await requestFn();
  };

  try {
    const response = await pRetry(run, {
      retries: 3, 
      factor: 2, 
      minTimeout: 1000 * 5, 
      maxTimeout: 1000 * 60 * 5,
      onFailedAttempt: (error: any) => { // Explicitly type error as any here for simplicity
        const errorCode = error?.code; // Attempt to access code property
        const rateLimitInfo = error?.rateLimit;
        const resetTime = rateLimitInfo?.reset ? new Date(rateLimitInfo.reset * 1000) : null;

        logger.warn(
          { 
            actionName,
            attempt: error.attemptNumber, 
            retriesLeft: error.retriesLeft, 
            errorMsg: error.message, 
            errorCode: errorCode,
            rateLimitReset: resetTime?.toISOString() ?? 'N/A' 
          },
          `API request attempt #${error.attemptNumber} failed for ${actionName}. Retries left: ${error.retriesLeft}.`
        );
        // If it was a rate limit error, log the reset time
        if (errorCode === 429 && resetTime) {
            const waitEstimate = Math.max(resetTime.getTime() - Date.now(), 0);
            logger.info(`Rate limit hit. Twitter suggests reset at ${resetTime.toISOString()} (approx ${Math.round(waitEstimate / 1000)}s). Retrying with exponential backoff.`);
        }
      },
      shouldRetry: (error: any) => { // Explicitly type error as any
        const errorCode = error?.code;
        // Only retry on rate limits (429) and server errors (5xx)
        if (typeof errorCode === 'number') {
             return errorCode === 429 || (errorCode >= 500 && errorCode < 600);
        }
        // Do not retry if code is not available or not a number
        return false; 
      },
      // Removing custom calculateDelay as it might not be compatible/needed
      // p-retry's exponential backoff will handle the delay.
      // We log the suggested reset time from Twitter in onFailedAttempt.
    });
    return response;
  } catch (error: any) {
    logger.error(
      {
        errorMsg: error?.message,
        errorCode: error?.code,
        errorData: error?.data,
        actionName
      },
      `API request failed permanently for ${actionName} after retries or due to unrecoverable error.`
    );
    return null;
  }
}

// --- Core X API Functions ---

/**
 * Posts a simple text tweet.
 * @param text The text content of the tweet.
 * @returns The ID of the created tweet, or null if failed.
 */
export async function postTweet(text: string): Promise<string | null> {
  const actionName = 'post tweet';
  logger.info(`Attempting to ${actionName}: "${text}"`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} skipped.`);
    return `simulated_${Date.now()}`; // Return a fake ID for simulation logging
  }

  const result = await handleApiRequest(() => xClient.tweet(text), actionName);

  if (result) {
    logger.info(`Tweet posted successfully! ID: ${result.data.id}`);
    return result.data.id;
  }
  return null;
}

/**
 * Replies to a specific tweet.
 * @param text The text content of the reply.
 * @param tweetId The ID of the tweet to reply to.
 * @returns The ID of the created reply tweet, or null if failed.
 */
export async function replyToTweet(text: string, tweetId: string): Promise<string | null> {
  const actionName = 'reply to tweet';
  logger.info(`Attempting to ${actionName} ${tweetId}: "${text}"`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} ${tweetId} skipped.`);
    return `simulated_reply_${Date.now()}`;
  }

  const result = await handleApiRequest(() => xClient.reply(text, tweetId), actionName);

  if (result) {
    logger.info(`Reply to ${tweetId} posted successfully! ID: ${result.data.id}`);
    return result.data.id;
  }
  return null;
}

/**
 * Retweets a specific tweet.
 * @param tweetId The ID of the tweet to retweet.
 * @returns True if retweet was successful (according to API), false otherwise.
 */
export async function retweet(tweetId: string): Promise<boolean> {
  const actionName = 'retweet';
  logger.info(`Attempting to ${actionName} tweet ${tweetId}`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} ${tweetId} skipped.`);
    return true; // Assume success for simulation
  }

  // Retweet requires the user ID of the bot
  let botUserId: string | undefined;
  try {
    const me = await twitterClientV2.me();
    botUserId = me.data.id;
  } catch (error: any) {
    logger.error({ error: error?.data || error }, 'Failed to get bot user ID for retweet');
    return false;
  }

  if (!botUserId) {
    logger.error('Could not determine bot user ID, cannot retweet.');
    return false;
  }

  const result = await handleApiRequest(() => xClient.retweet(botUserId!, tweetId), actionName);

  if (result && result.data.retweeted) {
    logger.info(`Tweet ${tweetId} retweeted successfully!`);
    return true;
  }
  logger.warn({ result: result?.data }, `Retweet action for ${tweetId} did not return expected success.`);
  return false;
}

/**
 * Searches for recent tweets based on configured keywords.
 * @param count The maximum number of tweets to return.
 * @returns An array of TweetCandidate objects.
 */
export async function searchRecentTweets(count: number = 10): Promise<TweetCandidate[]> {
  const actionName = 'search recent tweets';
  logger.info(`Attempting to ${actionName}...`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} skipped. Returning empty array.`);
    return [];
  }

  // --- Build Query ---
  // Simple strategy: pick one random topic, join its keywords with OR
  // Exclude retweets and replies for now to focus on original content
  const topics = Object.keys(config.topicKeywords);
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  const keywords = config.topicKeywords[randomTopic as keyof typeof config.topicKeywords];
  const query = `(${keywords.join(' OR ')}) -is:retweet -is:reply lang:en`;
  logger.debug(`Using search query: ${query}`);

  // --- Make API Call ---
  const result = await handleApiRequest(
    () => xClient.search(query, {
      max_results: Math.min(count, 100), // API max is 100 for recent search
      expansions: ['author_id'],
      'tweet.fields': ['created_at', 'public_metrics'],
      'user.fields': ['public_metrics'],
    }),
    actionName
  );

  // --- Process Results ---
  if (!result || !result.data.data) {
    logger.warn('Search returned no tweets or encountered an error.');
    return [];
  }

  const tweets = result.data.data;
  const users = result.includes?.users as ExpandedUser[] | undefined;
  const userMap = new Map(users?.map(user => [user.id, user]));

  const candidates: TweetCandidate[] = tweets.map((tweet: TweetV2) => {
    const author = userMap.get(tweet.author_id!);
    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id!,
      authorFollowers: author?.public_metrics?.followers_count ?? 0,
      likeCount: tweet.public_metrics?.like_count ?? 0,
      retweetCount: tweet.public_metrics?.retweet_count ?? 0,
      replyCount: tweet.public_metrics?.reply_count ?? 0,
      quoteCount: tweet.public_metrics?.quote_count ?? 0,
      createdAt: new Date(tweet.created_at!),
    };
  }).filter(candidate => candidate !== null) as TweetCandidate[];

  logger.info(`Found ${candidates.length} potential tweet candidates from search.`);
  return candidates;
}

// Keep the default export for potential direct client usage if needed elsewhere,
// but prefer using the specific exported functions.
export default xClient; 