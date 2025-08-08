// openaiClient.ts
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

// --- Basic Harmful Content Check (Post-Generation) ---
const harmfulPatterns = [
  /\b(kill|murder|rape|nazi|hate speech)\b/i,
];

function containsHarmfulContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  return harmfulPatterns.some(pattern => pattern.test(lowerText));
}

// --- Helpers ---
function extractOutputText(resp: any): string {
  // Preferred: SDK convenience field on Responses API
  if (resp?.output_text && typeof resp.output_text === 'string') return resp.output_text;

  // Fallback: walk the raw output array
  const output = resp?.output ?? resp?.response ?? [];
  for (const item of output) {
    const parts = item?.content ?? [];
    for (const part of parts) {
      // Common shapes: { type: "output_text", text } or { type: "text", text }
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.value === 'string') return part.value; // just in case
    }
  }
  return '';
}

/**
 * Generates text content (e.g., for a tweet or reply) using the configured OpenAI model.
 * @param userPrompt The specific instruction or context for the generation.
 * @returns The generated text content (string) or null on failure/safety.
 */
export async function generateContent(userPrompt: string): Promise<string | null> {
  const actionName = 'generate content';
  logger.debug({ userPrompt }, `Attempting to ${actionName}`);

  if (config.simulateMode) {
    logger.warn(`[SIMULATE] ${actionName} skipped. Returning placeholder.`);
    return "[Simulated OpenAI Content]";
  }

  const pRetry = (await import('p-retry')).default;

  const run = async () => {
    const resp = await openai.responses.create({
      model: selectedModel,
      input: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      // Force plain text to avoid tool/refusal structures where possible
      // response_format: { type: 'text' } as any,
      // Token cap suited for X; Responses API uses max_output_tokens
      max_output_tokens: 280,
    });

    let content = extractOutputText(resp);

    if (!content || typeof content !== 'string') {
      // Log the raw (stringified) response once to help debug shapes in the wild
      logger.debug({ rawResponse: JSON.stringify(resp) }, 'OpenAI raw response (no direct text found)');
      throw new Error('OpenAI response did not contain content.');
    }

    // Raw analysis log
    logger.debug(
      {
        rawContent: JSON.stringify(content),
        contentLength: content.length,
        hasProblematicChars: /[\u0000-\u001F\u007F-\u009F\uFFFD\uFEFF]/.test(content),
      },
      'OpenAI raw response analysis'
    );

    const trimmedContent = content.trim();

    // Remove surrounding quotes if present
    const cleanContent =
      trimmedContent.startsWith('"') && trimmedContent.endsWith('"')
        ? trimmedContent.slice(1, -1)
        : trimmedContent;

    logger.debug({ cleanContent: JSON.stringify(cleanContent) }, 'Cleaned OpenAI content');

    return cleanContent;
  };

  try {
    const generatedContent = await pRetry(run, {
      retries: 2,
      factor: 2,
      minTimeout: 1000 * 2,
      onFailedAttempt: (error: any) => {
        logger.warn(
          {
            actionName,
            attempt: error.attemptNumber,
            retriesLeft: error.retriesLeft,
            errorMsg: error.message,
            errorCode: error?.response?.status,
          },
          `OpenAI request attempt #${error.attemptNumber} failed for ${actionName}. Retries left: ${error.retriesLeft}.`
        );
      },
      shouldRetry: (error: any) => {
        const statusCode = error?.response?.status;
        if (typeof statusCode === 'number') {
          return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
        }
        return error?.code === 'ENOTFOUND' || error?.code === 'ETIMEDOUT';
      },
    });

    if (containsHarmfulContent(generatedContent)) {
      logger.error({ generatedContent }, 'Generated content failed harmful content check.');
      return null;
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
        userPrompt,
      },
      `OpenAI request failed permanently for ${actionName} after retries.`
    );
    return null;
  }
}

// Example usage (for testing)
// generateContent("Write a short, encouraging tweet for indie hackers working late.")
//   .then(console.log)
//   .catch(console.error);
