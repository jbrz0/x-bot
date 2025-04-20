import dotenv from 'dotenv';
dotenv.config(); // Load .env to potentially override defaults

// --- Environment Variables ---
const env = process.env;

// --- Bot Behavior Configuration ---
export const config = {
  // Topic weighting (higher = more focus, 0-10 scale)
  topicWeights: {
    productivity: 8,
    design: 7,
    scifi: 3,
    webdev: 5,
    apple: 4,
    minimalism: 3,
    lifeImprovement: 3,
    crypto: 4,
  },

  // Keywords or search queries associated with topics (used for fetching candidates)
  topicKeywords: {
    productivity: ['#productivity', '#automation', '#indiehacker', '#buildinpublic', 'SaaS', 'business process'],
    design: ['#UIUX', '#productdesign', '#designsystem', '#AIart', 'Figma', '#webdesign', 'graphic design'],
    scifi: ['#scifi', '#cyberpunk', '#solarpunk', 'future tech', 'space exploration'],
    webdev: ['#webdev', '#coding', '#typescript', '#javascript', 'React', 'Node.js', 'vibe coding'],
    apple: ['#Apple', '#iOS', '#macOS', '#iPadOS', 'Apple Vision Pro', 'SwiftUI'],
    minimalism: ['#minimalism', 'simple living', 'declutter', 'essentialism'],
    lifeImprovement: ['#habits', '#selfimprovement', '#healthtech', 'biohacking', 'mental wellness'],
    crypto: ['#crypto', '#web3', '#DeFi', 'blockchain', 'NFTs', 'Ethereum'],
  },

  // Engagement thresholds & rules
  engagement: {
    replyThreshold: 10, // Minimum engagement score to consider replying
    hoursSinceLastReplyAuthor: 48, // Avoid replying to same author within this time (hours)
  },

  // Posting cadence configuration (approximate times/counts)
  // TODO: Implement more robust cadence logic in chooseAction.ts
  cadence: {
    morning: { startHour: 6, endHour: 12, reposts: 2, original: 3 },
    afternoon: { startHour: 13, endHour: 17, replies: 2, original: 1 },
    evening: { startHour: 19, endHour: 23, replies: 1, reposts: 2, original: 2 },
    // Add checks to ensure these don't exceed rate limits over 3 hours
  },

  // Simulation mode (can be overridden by command-line arg or Vercel env var)
  simulateMode: env.SIMULATE_MODE === 'true',

  // Logging level
  logLevel: env.LOG_LEVEL || 'info',
};

// Example: Accessing config values
// import { config } from './config';
// console.log(config.topicWeights.design);
// console.log(config.engagement.replyThreshold); 