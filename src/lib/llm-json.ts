import OpenAI from "openai";
import { getLlmClient, getLlmEnv } from "@/lib/llm";
import { withTimeout } from "@/lib/with-timeout";

export async function requestJsonCompletion(input: {
  system: string;
  user: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ content: string; model: string }> {
  const env = getLlmEnv();
  const client = getLlmClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: input.system },
    { role: "user", content: input.user },
  ];

  const create = (jsonMode: boolean) =>
    client.chat.completions.create(
      {
        model: env.OPENROUTER_MODEL,
        temperature: 0,
        max_tokens: input.maxTokens ?? 4_096,
        messages,
        ...(jsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
      },
      {
        timeout: input.timeoutMs ?? 120_000,
        signal: AbortSignal.timeout(input.timeoutMs ?? 120_000),
      },
    );

  const timeoutMs = input.timeoutMs ?? 120_000;
  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await withTimeout(
      create(true),
      timeoutMs + 5_000,
      "OpenRouter JSON request timed out",
    );
  } catch (error) {
    const isFormatIssue =
      error instanceof OpenAI.APIError &&
      error.status === 400 &&
      /response_format|json|structured/i.test(error.message);
    if (!isFormatIssue) throw error;
    completion = await withTimeout(
      create(false),
      timeoutMs + 5_000,
      "OpenRouter JSON request timed out",
    );
  }

  return {
    content: completion.choices[0]?.message?.content ?? "",
    model: completion.model ?? env.OPENROUTER_MODEL,
  };
}
