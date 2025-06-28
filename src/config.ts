import dotenv from 'dotenv';
dotenv.config(); // Load .env to potentially override defaults

// --- Environment Variables ---
const env = process.env;

// --- Helper to parse numbers from environment variables ---
function parseIntEnv(envVar: string | undefined, defaultValue: number): number {
  if (envVar === undefined) return defaultValue;
  const parsed = parseInt(envVar, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// --- Bot Personality & Tone Prompt --- 
// Enhanced with rich character details from character.json
const systemPrompt = `Write a casual social media post. Sound like a real person, not an AI.

Avoid these AI-sounding phrases:
- "morning thoughts"
- "reflecting on"
- "diving into" 
- "let's explore"
- "in today's world"
- "it's fascinating how"

Instead write like:
- "been working on this thing..."
- "anyone else notice..."
- "quick update:"
- "so apparently"
- "just realized"

Keep it under 280 chars. Sound human.`;

// --- Bot Behavior Configuration ---
export const config = {
  // System prompt for OpenAI - defines the bot's personality and behavior
  systemPrompt: systemPrompt,

  // Example post patterns for inspiration
  postExamples: [
    "Design tip: Use 8-pt spacing + one bold accent color and 90% of 'busy UI' problems vanish. Simplicity scales. ✨",
    "Automating repetitive Figma exports with 20 lines of JS saved me 2 hrs/week – that's a full workday every quarter.",
    "Crypto UX still feels like Netscape '94. Every friction we remove is another step toward mainstream. Let's make wallets human-first.",
    "Vision Pro spatial canvases open wild doors for dashboard design – imagine dragging data widgets in 3D. Can't wait to prototype this.",
    "Reminder: your side-project doesn't need venture scale to change your life; a calm $2k MRR can fund a lot of freedom.",
    "Daily 'design stand-up' with myself: plan 3 outcomes, time-box 'em, ship before noon. Momentum compounds."
  ],

  // Character traits for more authentic content generation
  personality: {
    background: "Senior product designer, building web apps in AI, web3, and saas",
    interests: ["dark-mode aesthetics", "cyberpunk design", "landscape photography", "pourover coffee"],
    philosophy: "Pragmatic tech-optimist mixing minimal-zen with 'ship it' energy",
    experience: "Failed startups taught me to ship fast and stay solvent"
  },

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
    productivity: ['productivity', 'automation', 'indie hacking', 'build in public', 'SaaS', 'business process'],
    design: ['UI/UX design', 'UI design', 'UX design', 'product design', 'AI art', 'AI agents', 'AI software', 'figma', 'web design'],
    scifi: ['sci-fi futures', 'cyberpunk', 'solarpunk', 'future tech'],
    webdev: ['web development', 'typescript', 'vibe coding'],
    apple: ['Apple ecosystem', 'iOS', 'iPadOS', 'macOS'],
    crypto: ['crypto & DeFi', 'web3', 'blockchain', 'NFTs', 'Ethereum', 'L2', 'Solana', 'Base'],
    minimalism: ['minimalism', 'simple living'],
    lifeImprovement: ['biohacking', 'healthtech', 'life improvement'],
  },

  // Engagement thresholds & rules
  engagement: {
    replyThreshold: parseIntEnv(env.ENGAGEMENT_REPLY_THRESHOLD, 10),
    hoursSinceLastReplyAuthor: parseIntEnv(env.ENGAGEMENT_HOURS_SINCE_LAST_REPLY_AUTHOR, 48),
  },

  // Posting cadence configuration (approximate times/counts)
  // TODO: Implement more robust cadence logic in chooseAction.ts
  cadence: {
    morning: {
      startHour: 6,
      endHour: 12,
      reposts: parseIntEnv(env.CADENCE_MORNING_REPOSTS, 2),
      original: parseIntEnv(env.CADENCE_MORNING_ORIGINAL, 3),
      // replies not applicable in default morning window
    },
    afternoon: {
      startHour: 13,
      endHour: 17,
      replies: parseIntEnv(env.CADENCE_AFTERNOON_REPLIES, 2),
      original: parseIntEnv(env.CADENCE_AFTERNOON_ORIGINAL, 1),
      // reposts not applicable in default afternoon window
    },
    evening: {
      startHour: 19,
      endHour: 24, // Extended to midnight for testing
      replies: parseIntEnv(env.CADENCE_EVENING_REPLIES, 1),
      reposts: parseIntEnv(env.CADENCE_EVENING_REPOSTS, 2),
      original: parseIntEnv(env.CADENCE_EVENING_ORIGINAL, 2),
    },
    lateNight: {
      startHour: 0,
      endHour: 6, // Midnight to 6 AM for testing
      original: 1, // Allow 1 original post for testing
      replies: 1,
      reposts: 1,
    },
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