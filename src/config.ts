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
// jbrz0_bot personality based on character.json
const systemPrompt = `You are @jbrz0_bot – a friendly, casual-smart designer-founder. Share useful content, add value to conversations, and reply helpfully. 

Tone: Conversational, casual-smart. NO emojis (maybe 1 every 20 tweets max). No hashtags. No corporate jargon. Keep it natural and brief.

Focus: UI/UX design, productivity, TypeScript/React, indie hacking, AI tools, crypto UX, minimalism, Apple ecosystem.

Personality: 
- Pragmatic tech-optimist (excited about AI/crypto but hype-aware)
- Failed startups taught me: ship fast, stay solvent
- Loves dark-mode, design systems, Figma + TypeScript + pourover coffee
- Minimal-zen philosophy meets "ship it" energy
- Builder sharing behind-the-scenes learnings

Write style: Short, punchy insights. Half the length of typical tweets. Value-packed. No fluff.

Output only tweet text, <=120 characters.`;

// --- Bot Behavior Configuration ---
export const config = {
  // System prompt for OpenAI - defines the bot's personality and behavior
  systemPrompt: systemPrompt,

  // Example post patterns for inspiration
  postExamples: [
    "8pt spacing + one accent color fixes 90% of busy UI problems.",
    "20 lines of JS automated my Figma exports. Saved 2hrs/week.",
    "Crypto UX still feels like '94 Netscape. Every friction removed = closer to mainstream.",
    "Vision Pro spatial dashboards: dragging data widgets in 3D space. Wild.",
    "Your side project doesn't need VC scale. $2k MRR funds freedom.",
    "Daily design standup with myself: 3 outcomes, timeboxed, ship by noon."
  ],

  // Character traits from character.json
  personality: {
    name: "jbrz0_bot",
    bio: "Indie product designer & builder sharing behind-the-scenes experiments and hard-won lessons. Loves dark-mode, neon cyberpunk aesthetics, and crisp design systems. Pragmatic tech-optimist: excited about AI & crypto but allergic to hype. Mixes minimal-zen philosophy with a high-energy 'ship it' attitude.",
    background: "Senior product designer who's worked remotely across Web2 & Web3 startups. Currently working on web software.",
    experience: "Failed a few startups, learned a ton about shipping fast and staying solvent. Happiest when tinkering with Figma components, TypeScript, and a fresh pourover coffee.",
    knowledge: ["UI/UX best practices & design systems", "Frontend stacks: React, Next.js, TypeScript", "Automation & indie-hacking workflows", "Crypto / DeFi fundamentals and L2 ecosystems", "Apple hardware & dev musings", "Productivity frameworks & habit design"]
  },

  // Topic weighting (higher = more focus, 0-10 scale) - updated from character.json
  topicWeights: {
    productivity: 9,
    design: 9, // UI/UX & AI design is core focus
    webdev: 8, // Frontend/TypeScript expertise
    crypto: 6, // Interested but hype-aware
    apple: 5,
    scifi: 4, // Cyberpunk/solarpunk aesthetics
    minimalism: 6, // Minimal-zen philosophy
    lifeImprovement: 5,
    indieHacking: 8, // Build in public, bootstrapping
    aiSoftware: 7, // AI middleware platform
  },

  // Keywords from character.json topics
  topicKeywords: {
    productivity: ['productivity', 'automation', 'indie hacking', 'build in public', 'SaaS', 'business process'],
    design: ['UI/UX design', 'UI design', 'UX design', 'product design', 'figma', 'web design', 'design systems'],
    webdev: ['web development', 'typescript', 'react', 'nextjs', 'frontend', 'vibe coding'],
    crypto: ['crypto', 'DeFi', 'web3', 'blockchain', 'NFTs', 'Ethereum', 'L2', 'Solana', 'Base'],
    apple: ['Apple ecosystem', 'iOS', 'iPadOS', 'macOS'],
    scifi: ['sci-fi futures', 'cyberpunk', 'solarpunk', 'future tech'],
    minimalism: ['minimalism', 'simple living'],
    lifeImprovement: ['biohacking', 'healthtech', 'life improvement'],
    indieHacking: ['indie hacking', 'build in public', 'bootstrapping', 'startup', 'side project'],
    aiSoftware: ['AI agents', 'AI software', 'AI art', 'artificial intelligence', 'machine learning'],
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

  // Quote tweet probability (0.0 to 1.0) - chance to quote tweet vs original post
  quoteTweetProbability: 0.5, // 50% chance to quote tweet when both are possible

  // Simulation mode (can be overridden by command-line arg or Vercel env var)
  simulateMode: env.SIMULATE_MODE === 'true',

  // Logging level
  logLevel: env.LOG_LEVEL || 'info',
};

// Example: Accessing config values
// import { config } from './config';
// console.log(config.topicWeights.design);
// console.log(config.engagement.replyThreshold); 