import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { config } from '../config';

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
const defaultModel = 'gpt-5-mini';
const selectedModel = OPENAI_MODEL || defaultModel;

logger.info(`OpenAI client initialized. Using model: ${selectedModel}`);

// --- Personality & Tone Prompt --- 
// Removed: Now defined and imported from config.ts
// const systemPrompt = `...`; 

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
  const actionName = 'generate content';
  logger.debug({ userPrompt }, `Attempting to ${actionName}`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} skipped. Returning placeholder.`);
    return "[Simulated OpenAI Content]"; // Return placeholder for simulation
  }

  // Dynamically import p-retry
  const pRetry = (await import('p-retry')).default;

  const run = async () => {
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: "system", content: config.systemPrompt }, // Use prompt from config
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: 280, // Max length roughly suitable for X
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      // Throw an error to trigger retry if content is missing
      throw new Error('OpenAI response did not contain content.'); 
    }
    
    // Debug logging to see exactly what we got
    logger.debug({ 
      rawContent: JSON.stringify(content),
      contentLength: content.length,
      hasProblematicChars: /[\u0000-\u001F\u007F-\u009F\uFFFD\uFEFF]/.test(content)
    }, 'OpenAI raw response analysis');
    
    const trimmedContent = content.trim();
    
    // Remove surrounding quotes if present
    const cleanContent = trimmedContent.startsWith('"') && trimmedContent.endsWith('"') 
      ? trimmedContent.slice(1, -1) 
      : trimmedContent;
    
    logger.debug({ cleanContent: JSON.stringify(cleanContent) }, 'Cleaned OpenAI content');
    
    return cleanContent;
  };

  try {
    const generatedContent = await pRetry(run, {
        retries: 2, // Retry 2 times on failure (total 3 attempts)
        factor: 2,
        minTimeout: 1000 * 2, // Start with 2 seconds
        onFailedAttempt: (error: any) => {
            logger.warn(
              { 
                actionName,
                attempt: error.attemptNumber, 
                retriesLeft: error.retriesLeft, 
                errorMsg: error.message, 
                errorCode: error?.response?.status // OpenAI errors often have status in response
              },
              `OpenAI request attempt #${error.attemptNumber} failed for ${actionName}. Retries left: ${error.retriesLeft}.`
            );
        },
        shouldRetry: (error: any) => {
            // Check for common transient OpenAI error codes (e.g., 429, 5xx) 
            // Accessing error properties safely
            const statusCode = error?.response?.status;
            if (typeof statusCode === 'number') {
                return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
            }
            // Also retry on generic network errors if status code isn't available
            return error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT'; 
        },
    });

    // Post-generation safeguard check
    if (containsHarmfulContent(generatedContent)) {
      logger.error({ generatedContent }, 'Generated content failed harmful content check.');
      return null; // Do not return harmful content
    }

    logger.debug({ response: generatedContent }, 'Content generated successfully');
    return generatedContent;

  } catch (error: any) {
    logger.error(
      {
        errorMsg: error?.message,
        errorCode: error?.response?.status,
        errorData: error?.response?.data,
        actionName,
        userPrompt
      },
      `OpenAI request failed permanently for ${actionName} after retries.`
    );
    return null; // Return null on final generation error
  }
}

// Example usage (for testing)
// generateContent("Write a short, encouraging tweet for indie hackers working late.")
//   .then(console.log)
//   .catch(console.error); 