import { TwitterApi, TweetV2, UserV2 } from 'twitter-api-v2';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import logger from '../utils/logger';
import { config } from '../config';

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

// TwitterAPI.io response interfaces
interface TwitterApiUser {
  id: string;
  userName: string;
  name: string;
  followers: number;
  following: number;
  description: string;
  profilePicture: string;
  createdAt: string;
}

interface TwitterApiTweet {
  id: string;
  text: string;
  author: TwitterApiUser;
  retweetCount: number;
  replyCount: number;
  likeCount: number;
  quoteCount: number;
  createdAt: string;
}

interface TwitterApiSearchResponse {
  tweets: TwitterApiTweet[];
  has_next_page: boolean;
  next_cursor: string;
}

dotenv.config();

// TwitterAPI.io credentials for searching
const { TWITTERAPI_IO_KEY, TWITTERAPI_IO_USER_ID } = process.env;

// Official X API credentials for posting
const { X_APP_KEY, X_APP_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

// Debug logging
console.log('DEBUG - Environment variables loaded:');
console.log('TWITTERAPI_IO_KEY:', TWITTERAPI_IO_KEY ? 'SET' : 'NOT SET');
console.log('TWITTERAPI_IO_USER_ID:', TWITTERAPI_IO_USER_ID ? 'SET' : 'NOT SET');
console.log('X_APP_KEY:', X_APP_KEY ? 'SET' : 'NOT SET');

// Check TwitterAPI.io credentials
if (!TWITTERAPI_IO_KEY || !TWITTERAPI_IO_USER_ID) {
  const errorMsg = 'Missing TwitterAPI.io credentials in environment variables.';
  logger.error(errorMsg);
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

// Check X API credentials
if (!X_APP_KEY || !X_APP_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  const errorMsg = 'Missing X API credentials in environment variables.';
  logger.error(errorMsg);
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

// Initialize official X API client for posting
const twitterClientV2 = new TwitterApi({
  appKey: X_APP_KEY || (process.env.NODE_ENV === 'test' ? 'test_app_key' : ''),
  appSecret: X_APP_SECRET || (process.env.NODE_ENV === 'test' ? 'test_app_secret' : ''),
  accessToken: X_ACCESS_TOKEN || (process.env.NODE_ENV === 'test' ? 'test_access_token' : ''),
  accessSecret: X_ACCESS_SECRET || (process.env.NODE_ENV === 'test' ? 'test_access_secret' : ''),
}).v2;

const xClient = twitterClientV2.readWrite;

logger.info('TwitterAPI.io client initialized for searching.');
logger.info('X API v2 client initialized for posting.');

// --- Helper Function for Error Handling & Retries ---

/**
 * Wraps API calls with robust error handling and retries
 */
async function handleApiRequest<T>(
  requestFn: () => Promise<T>,
  actionName: string
): Promise<T | null> {
  try {
    const response = await requestFn();
    return response;
  } catch (error: any) {
    logger.error(
      { 
        actionName, 
        errorMsg: error?.message, 
        status: error?.status,
        code: error?.code,
        data: error?.data,
        errors: error?.errors,
        rateLimit: error?.rateLimit,
        fullError: error
      },
      `API request failed for ${actionName}.`
    );
    return null;
  }
}

/**
 * Make HTTP request to TwitterAPI.io
 */
async function makeTwitterApiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `https://api.twitterapi.io${endpoint}`;
  const headers = {
    'x-api-key': TWITTERAPI_IO_KEY!,
    'Content-Type': 'application/json',
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// --- Core X API Functions ---

/**
 * Sanitizes text content to remove problematic characters that might cause API errors
 */
function sanitizeContent(text: string): string {
  return text
    // Remove non-printable characters and invalid UTF-8
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Remove problematic Unicode characters that might cause encoding issues
    .replace(/[\uFFFD\uFEFF]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Posts a simple text tweet using official X API.
 * @param text The text content of the tweet.
 * @returns The ID of the created tweet, or null if failed.
 */
export async function postTweet(text: string): Promise<string | null> {
  const actionName = 'post tweet';
  
  // Sanitize content before posting
  const sanitizedText = sanitizeContent(text);
  logger.info(`Attempting to ${actionName}: "${sanitizedText.substring(0, 50)}..."`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} skipped: "${sanitizedText}"`);
    return 'simulated_tweet_id';
  }

  const result = await handleApiRequest(() => xClient.tweet(sanitizedText), actionName);

  if (result && result.data.id) {
    logger.info(`Tweet posted successfully with ID: ${result.data.id}`);
    return result.data.id;
  }
  logger.warn({ result: result?.data }, 'Tweet posting did not return expected ID.');
  return null;
}

/**
 * Replies to a specific tweet using official X API.
 * @param text The text content of the reply.
 * @param tweetId The ID of the tweet to reply to.
 * @returns The ID of the created reply tweet, or null if failed.
 */
export async function replyToTweet(text: string, tweetId: string): Promise<string | null> {
  const actionName = 'reply to tweet';
  logger.info(`Attempting to ${actionName} ${tweetId}: "${text.substring(0, 50)}..."`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} ${tweetId} skipped: "${text}"`);
    return 'simulated_reply_id';
  }

  const result = await handleApiRequest(
    () => xClient.reply(text, tweetId),
    actionName
  );

  if (result && result.data.id) {
    logger.info(`Reply posted successfully with ID: ${result.data.id}`);
    return result.data.id;
  }
  logger.warn({ result: result?.data }, `Reply to ${tweetId} did not return expected ID.`);
  return null;
}

/**
 * Retweets a specific tweet using official X API.
 * @param tweetId The ID of the tweet to retweet.
 * @returns True if retweet was successful (according to API), false otherwise.
 */
export async function retweet(tweetId: string): Promise<boolean> {
  const actionName = 'retweet';
  logger.info(`Attempting to ${actionName} tweet ${tweetId}`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} ${tweetId} skipped.`);
    return true;
  }

  // Get bot user ID for retweet
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
 * Quote tweets a specific tweet with commentary using official X API.
 * @param text The commentary text to add to the quote tweet.
 * @param tweetId The ID of the tweet to quote.
 * @returns The ID of the created quote tweet, or null if failed.
 */
export async function quoteTweet(text: string, tweetId: string): Promise<string | null> {
  const actionName = 'quote tweet';
  logger.info(`Attempting to ${actionName} ${tweetId}: "${text.substring(0, 50)}..."`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} ${tweetId} skipped: "${text}"`);
    return 'simulated_quote_tweet_id';
  }

  const sanitizedText = sanitizeContent(text);
  
  const result = await handleApiRequest(
    () => xClient.tweet(sanitizedText, { quote_tweet_id: tweetId }),
    actionName
  );

  if (result && result.data.id) {
    logger.info(`Quote tweet posted successfully with ID: ${result.data.id}`);
    return result.data.id;
  }
  logger.warn({ result: result?.data }, `Quote tweet for ${tweetId} did not return expected ID.`);
  return null;
}

/**
 * Searches for recent tweets using TwitterAPI.io based on configured keywords.
 * @param count The maximum number of tweets to return.
 * @returns An array of TweetCandidate objects.
 */
export async function searchRecentTweets(count: number = 10): Promise<TweetCandidate[]> {
  const actionName = 'search recent tweets via TwitterAPI.io';
  logger.info(`Attempting to ${actionName}...`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} skipped. Returning empty array.`);
    return [];
  }

  // Build search query from configured keywords
  const allKeywords = Object.values(config.topicKeywords).flat();
  const uniqueKeywords = [...new Set(allKeywords)];
  const query = uniqueKeywords.join(' OR ');
  
  logger.debug(`Using TwitterAPI.io search query: ${query}`);

  // Make API call to TwitterAPI.io for searching
  const result = await handleApiRequest(
    () => makeTwitterApiRequest(`/twitter/tweet/advanced_search?query=${encodeURIComponent(query)}&count=${Math.min(count, 100)}`),
    actionName
  );

  if (!result || !result.tweets) {
    logger.warn('TwitterAPI.io search returned no tweets or encountered an error.');
    return [];
  }

  const candidates: TweetCandidate[] = result.tweets.map((tweet: TwitterApiTweet) => {
    return {
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author.id,
      authorFollowers: tweet.author.followers,
      likeCount: tweet.likeCount,
      retweetCount: tweet.retweetCount,
      replyCount: tweet.replyCount,
      quoteCount: tweet.quoteCount,
      createdAt: new Date(tweet.createdAt),
    };
  });

  logger.info(`Found ${candidates.length} potential tweet candidates from TwitterAPI.io search.`);
  return candidates;
}

// Keep the default export for potential direct client usage if needed elsewhere,
// but prefer using the specific exported functions.
export default xClient;