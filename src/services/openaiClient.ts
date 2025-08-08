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
function extractOutputText(resp: any): { text: string; refusal?: string; status?: string; incompleteReason?: string } {
  const status = resp?.status as string | undefined;
  const incompleteReason = resp?.incomplete_details?.reason as string | undefined;

  // Preferred convenience field
  if (typeof resp?.output_text === 'string' && resp.output_text.trim()) {
    return { text: resp.output_text.trim(), status, incompleteReason };
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
      if ((p?.type === 'refusal' || p?.type === 'safety') && typeof p?.refusal === 'string') {
        refusalMsg = p.refusal.trim();
      }
    }
  }

  return { text: text.trim(), refusal: refusalMsg || undefined, status, incompleteReason };
}

function stripSurroundingQuotes(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

function compact(obj: any, max = 1800): string {
  const s = JSON.stringify(obj);
  return s.length > max ? s.slice(0, max) + ' …(truncated)…' : s;
}

// --- Internal: call Responses API with controls, optionally bump tokens ---
async function callResponsesOnce({
  userPrompt,
  maxOutputTokens,
}: {
  userPrompt: string;
  maxOutputTokens: number;
}) {
  const resp = await openai.responses.create({
    model: selectedModel,
    input: [
      { role: 'system', content: config.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    // Encourage less “thinking” and shorter text
    reasoning: { effort: 'low' } as any,
    text: { verbosity: 'low', format: { type: 'text' } } as any,
    max_output_tokens: maxOutputTokens,
  });

  return resp;
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
    let resp = await callResponsesOnce({ userPrompt, maxOutputTokens: 320 });
    let { text, refusal, status, incompleteReason } = extractOutputText(resp);

    // If we ran out of tokens before any text, bump once and try again inline
    if ((!text || text.length === 0) && status === 'incomplete' && incompleteReason === 'max_output_tokens') {
      logger.info(
        { respSnapshot: compact(resp) },
        'Responses API incomplete due to token budget; retrying with larger budget'
      );
      resp = await callResponsesOnce({ userPrompt, maxOutputTokens: 640 });
      ({ text, refusal, status, incompleteReason } = extractOutputText(resp));
    }

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

    // No direct text — log a snapshot at INFO so it shows even if debug is off
    logger.info(
      { respSnapshot: compact(resp) },
      'Responses API returned no direct text; snapshot attached'
    );

    // 2) Fallback: Chat Completions (some environments produce simpler text here)
    const completion = await openai.chat.completions.create({
      model: selectedModel,
      messages: [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      // GPT-5-compatible param name on chat endpoint
      max_completion_tokens: 200, // slightly smaller; this is just a fallback
      // NOTE: do NOT pass tool_choice without tools; it causes a 400
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
    logger.info(
      { respSnapshot: compact({ resp, completion }) },
      'Neither Responses nor Chat returned text; snapshot attached'
    );
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
