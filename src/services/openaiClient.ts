import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const { OPENAI_API_KEY, OPENAI_MODEL } = process.env;

// Check credentials
if (!OPENAI_API_KEY) {
  const errorMsg = 'Missing OPENAI_API_KEY in environment variables.';
  logger.error(errorMsg);
  // Only exit if not in test environment
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || (process.env.NODE_ENV === 'test' ? 'test_openai_key' : ''), 
});

// Simple model router - allows easily switching models via env var
const defaultModel = 'gpt-4o-mini';
const selectedModel = OPENAI_MODEL || defaultModel;

logger.info(`OpenAI client initialized. Using model: ${selectedModel}`);

// --- Personality & Tone Prompt --- 
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

// --- Basic Harmful Content Check (Post-Generation) ---
// This is a very rudimentary check. Consider more sophisticated methods if needed.
const harmfulPatterns = [
  /\b(kill|murder|rape|nazi|hate speech)\b/i, // Example keywords
  // Add more specific patterns or use a dedicated content moderation API/library for production
];

function containsHarmfulContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return harmfulPatterns.some(pattern => pattern.test(lowerText));
}

/**
 * Generates text content (e.g., for a tweet or reply) using the configured OpenAI model.
 * @param userPrompt The specific instruction or context for the generation (e.g., "Write a tweet about...", "Draft a reply to this tweet: ...")
 * @returns The generated text content.
 */
export async function generateContent(userPrompt: string): Promise<string | null> {
  logger.debug({ userPrompt }, `Generating content for prompt`);
  try {
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7, // Adjust for desired creativity/predictability
      max_tokens: 280, // Max length roughly suitable for X
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI response did not contain content.');
    }

    const trimmedContent = content.trim();

    // Post-generation safeguard check
    if (containsHarmfulContent(trimmedContent)) {
      logger.error({ generatedContent: trimmedContent }, 'Generated content failed harmful content check.');
      return null; // Do not return harmful content
    }

    logger.debug({ response: trimmedContent }, 'Content generated successfully');
    return trimmedContent;

  } catch (error) {
    logger.error({ error, userPrompt }, 'Failed to generate content with OpenAI');
    // TODO: Implement retry logic if appropriate for OpenAI calls
    return null; // Return null on generation error
  }
}

// Example usage (for testing)
// generateContent("Write a short, encouraging tweet for indie hackers working late.")
//   .then(console.log)
//   .catch(console.error); 