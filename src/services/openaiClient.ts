// openaiClient.ts
import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { config } from '../config';

dotenv.config();

const { OPENAI_API_KEY, OPENAI_MODEL } = process.env;

// --- Credentials ---
if (!OPENAI_API_KEY) {
  const errorMsg = 'Missing OPENAI_API_KEY in environment variables.';
  logger.error(errorMsg);
  if (process.env.NODE_ENV !== 'test') process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || (process.env.NODE_ENV === 'test' ? 'test_openai_key' : ''),
});

// --- Model routing ---
const defaultModel = 'gpt-5-mini';
const selectedModel = OPENAI_MODEL || defaultModel;
logger.info(`OpenAI client initialized. Using model: ${selectedModel}`);

// --- Basic Harmful Content Check (Post-Generation) ---
const harmfulPatterns = [
  /\b(kill|murder|rape|nazi|hate speech)\b/i,
];

function containsHarmfulContent(text: string | null | undefined): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return harmfulPatterns.some((pattern) => pattern.test(lowerText));
}

// --- Helpers ---
function extractOutputText(resp: any): { text: string; refusal?: string } {
  // Preferred convenience field
  if (typeof resp?.output_text === 'string' && resp.output_text.trim()) {
    return { text: resp.output_text.trim() };
  }

  // Walk output array
  const out = resp?.output ?? resp?.response ?? [];
  let text = '';
  let refusalMsg = '';

  for (const item of out) {
    const parts = item?.content ?? [];
    for (const p of parts) {
      if (typeof p?.text === 'string' && p.text.trim()) {
        text += (text ? '\n' : '') + p.text.trim();
      }
      // Some responses surface a refusal/safety block
      if ((p?.type === 'refusal' || p?.type === 'safety') && typeof p?.refusal === 'string') {
        refusalMsg = p.refusal.trim();
      }
    }
  }

  return { text: text.trim(), refusal: refusalMsg || undefined };
}

function stripSurroundingQuotes(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

function compact(obj: any, max = 1800): string {
  const s = JSON.stringify(obj);
  return s.length > max ? s.slice(0, max) + ' …(truncated)…' : s;
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
    return '[Simulated OpenAI Content]';
  }

  const pRetry = (await import('p-retry')).default;

  const run = async () => {
    // 1) Try Responses API first (primary for GPT-5)
    const resp = await openai.responses.create({
      model: selectedModel,
      input: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      // NOTE: do not pass response_format here; not accepted by current SDK types
      max_output_tokens: 280,
    });

    const { text, refusal } = extractOutputText(resp);

    if (refusal && !text) {
      logger.warn({ refusal }, 'Model returned refusal without text.');
    }

    if (text) {
      logger.debug(
        {
          rawContent: JSON.stringify(text),
          contentLength: text.length,
          hasProblematicChars: /[\u0000-\u001F\u007F-\u009F\uFFFD\uFEFF]/.test(text),
        },
        'OpenAI raw response analysis (Responses API)'
      );
      return stripSurroundingQuotes(text);
    }

    // 2) Fallback: Chat Completions (some environments produce simpler text here)
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      // GPT-5-compatible param name on chat endpoint
      max_completion_tokens: 280,
    });

    const cc = completion?.choices?.[0];
    const content = cc?.message?.content?.trim();

    if (content) {
      logger.debug(
        {
          rawContent: JSON.stringify(content),
          contentLength: content.length,
          hasProblematicChars: /[\u0000-\u001F\u007F-\u009F\uFFFD\uFEFF]/.test(content),
        },
        'OpenAI raw response analysis (Chat Completions fallback)'
      );
      return stripSurroundingQuotes(content);
    }

    // 3) Truly no content — log compact snapshot and throw to trigger retry
    logger.debug({ rawResponses: compact({ resp, completion }) }, 'No direct text found in responses');
    throw new Error('OpenAI response did not contain content.');
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
