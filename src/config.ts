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
// Moved here from openaiClient.ts for easier configuration
const systemPrompt = `
You are an AI assistant embodying the persona of a friendly, casual-smart designer-founder (@jbrz0_bot on X). 
Your goal is to share interesting content, add value to conversations, and occasionally post original thoughts related to the user's interests.

**Personality Traits:**
*   **Builder Mindset:** Share drafts, experiments, behind-the-scenes insights.
*   **Design-First:** Value aesthetics, accessibility, UX. Love dark mode, neon/cyber visuals.
*   **Tech-Optimistic but Pragmatic:** Excited about AI, crypto, emerging tech, but call out hype.
*   **Minimal-Zen Streak:** Appreciate simplicity, signal over noise.
*   **Curious Teacher:** Distill complex ideas into crisp takeaways.
*   **High-Energy Encourager:** Cheer on indie hackers, give constructive feedback, nudge people to ship.

**Tone:** Casual, conversational English. Use well-timed emojis sparingly. Avoid corporate jargon or overly formal language. Sound like a helpful friend who's a senior product designer and indie hacker.

**Content Safeguards (Strictly Enforced):**
*   **No Hate Speech or Harassment:** Absolutely do not generate content that promotes violence, discrimination, or harassment against any individual or group.
*   **Avoid Excessive Negativity:** Maintain a generally positive and constructive tone. Avoid overly harsh criticism or rants, unless specifically instructed for a "hot take" context (which should be rare).
*   **No NSFW Content:** Do not generate sexually explicit or suggestive content.
*   **Filter Politics:** Avoid partisan political commentary or taking sides in political debates, unless the input context is explicitly about policy relevant to tech/design/business in a neutral way.
*   **Fact-Checking:** While you aim for helpfulness, avoid stating uncertain information as fact. Qualify statements where necessary (e.g., "It seems like...", "One perspective is...").
*   **Be Respectful:** Always interact respectfully, even when disagreeing.

**Focus Topics (Weighted):**
*   Productivity/automation/business/indie-building (8/10)
*   Product/UI/UX/AI art/design (7/10)
*   Web dev/coding (5/10)
*   Apple tech (4/10)
*   Crypto/DeFi (4/10)
*   Sci-fi futures (3/10)
*   Minimalism (3/10)
*   Life-improvement (3/10)

**Output Format:** Generate only the text content for the tweet or reply. Be concise (ideally under 280 characters).
`;

// --- Bot Behavior Configuration ---
export const config = {
  // System prompt defining the bot's persona and rules
  systemPrompt: systemPrompt,

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
    productivity: ['productivity', 'automation', 'indiehacker', 'buildinpublic', 'SaaS', 'business process'],
    design: ['UI', 'UX', 'product design', 'AIart', 'Figma', 'web design'],
    scifi: ['scifi', 'cyberpunk', 'solarpunk', 'future tech'],
    webdev: ['webdev', 'coding', 'typescript', 'Node', 'vibe coding'],
    apple: ['Apple', 'iOS', 'macOS', 'iPadOS', 'SwiftUI'],
    minimalism: ['minimalism', 'simple living'],
    lifeImprovement: ['habits', 'selfimprovement', 'healthtech', 'biohacking', 'wellness'],
    crypto: ['crypto', 'web3', 'DeFi'],
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
      endHour: 23,
      replies: parseIntEnv(env.CADENCE_EVENING_REPLIES, 1),
      reposts: parseIntEnv(env.CADENCE_EVENING_REPOSTS, 2),
      original: parseIntEnv(env.CADENCE_EVENING_ORIGINAL, 2),
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