import OpenAI from "openai";
import { assertEnv } from "./env";

interface CachedClient {
  client: OpenAI;
  apiKey: string;
  baseURL: string;
}

let cached: CachedClient | null = null;

export function getLlmEnv() {
  return assertEnv("llm");
}

/**
 * Returns a cached OpenRouter client (OpenAI-compatible) configured from the
 * server-side environment. The API key never leaves this module.
 */
export function getLlmClient(): OpenAI {
  const env = getLlmEnv();

  if (
    !cached ||
    cached.apiKey !== env.OPENROUTER_API_KEY ||
    cached.baseURL !== env.OPENROUTER_BASE_URL
  ) {
    cached = {
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      client: new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: env.OPENROUTER_BASE_URL,
        timeout: 30_000,
        maxRetries: 0,
        defaultHeaders: {
          "HTTP-Referer": "https://dealos.local",
          "X-Title": "DealOS Infrastructure Test",
        },
      }),
    };
  }

  return cached.client;
}
