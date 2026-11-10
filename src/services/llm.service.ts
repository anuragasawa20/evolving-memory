import OpenAI from "openai";
import { z } from "zod";
import { getLlmClient, getLlmEnv } from "@/lib/llm";
import { IntegrationError, toSafeError } from "@/lib/errors";
import { buildHealth } from "@/lib/health";
import { logIntegration } from "@/lib/logger";
import { withTimeout } from "@/lib/with-timeout";
import {
  parseCallAnalysis,
  type CallAnalysis,
} from "@/lib/call-analysis";
import type { LlmTestDetails, ServiceHealth } from "@/types/infrastructure";

const llmResponseSchema = z.object({
  status: z.string().min(1),
  message: z.string().min(1),
});

const SYSTEM_PROMPT =
  'You are a connectivity self-test for the DealOS platform. Respond with ONLY a single JSON object and no surrounding prose. The JSON must have exactly these string fields: "status" (must be "connected") and "message" (a short greeting).';

const USER_PROMPT =
  'Return a JSON object with:\n- status: "connected"\n- message: a short greeting';

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      "Model returned an empty response",
      "llm",
    );
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall through to lenient extraction.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // Fall through to error.
    }
  }

  throw new IntegrationError(
    "INVALID_RESPONSE",
    "Model response did not contain valid JSON",
    "llm",
  );
}

function mapOpenAiError(error: unknown): IntegrationError {
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    if (
      error.name === "APIConnectionTimeoutError" ||
      /timeout/i.test(error.message)
    ) {
      return new IntegrationError(
        "TIMEOUT",
        "OpenRouter request timed out",
        "llm",
        status,
      );
    }
    if (status === 401) {
      return new IntegrationError(
        "UNAUTHORIZED",
        "OpenRouter rejected the API key (401)",
        "llm",
        status,
      );
    }
    if (status === 402) {
      return new IntegrationError(
        "INSUFFICIENT_CREDITS",
        "OpenRouter reports insufficient credits (402)",
        "llm",
        status,
      );
    }
    if (status === 429) {
      return new IntegrationError(
        "RATE_LIMITED",
        "OpenRouter rate limit reached (429)",
        "llm",
        status,
      );
    }
    if (status >= 500) {
      return new IntegrationError(
        "PROVIDER_ERROR",
        `OpenRouter upstream error (${status})`,
        "llm",
        status,
      );
    }
    return new IntegrationError(
      "PROVIDER_ERROR",
      `OpenRouter request failed (${status || "unknown"})`,
      "llm",
      status,
    );
  }

  if (error instanceof IntegrationError) {
    return error;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError" || /timeout/i.test(error.message)) {
      return new IntegrationError(
        "TIMEOUT",
        "OpenRouter request timed out",
        "llm",
      );
    }
    return new IntegrationError(
      "NETWORK_ERROR",
      "Failed to reach OpenRouter",
      "llm",
    );
  }

  return new IntegrationError("UNKNOWN", "Unknown OpenRouter error", "llm");
}

const ANALYSIS_SYSTEM_PROMPT = `You are DealOS, a sales conversation intelligence agent.

Analyze the supplied sales call transcript.

Extract only information supported by the conversation.

Identify:
- Customer pain points
- Objections
- Buying signals
- Requirements
- Commitments
- Stakeholders
- Budget information
- Timeline information
- Decision criteria
- Unresolved questions

For each important fact, provide supporting evidence
from the transcript when possible.

Distinguish explicit statements from interpretations. Set "inferred": true whenever a fact is an interpretation rather than a direct customer statement.

Do not invent customer information.
Do not treat a hypothetical question as a buying signal.
Do not assume a deal has progressed just because
the customer expressed interest.

Return the requested structured JSON only.`;

const ANALYSIS_SCHEMA_HINT = `Return one JSON object with exactly these fields:
{
  "summary": "string",
  "painPoints": [{ "content": "string", "evidence": "optional string", "inferred": "optional boolean" }],
  "objections": [{ "content": "string", "severity": "LOW | MEDIUM | HIGH", "evidence": "optional string", "inferred": "optional boolean" }],
  "buyingSignals": [{ "content": "string", "evidence": "optional string", "inferred": "optional boolean" }],
  "requirements": [{ "content": "string", "evidence": "optional string", "inferred": "optional boolean" }],
  "commitments": [{ "content": "string", "evidence": "optional string", "inferred": "optional boolean" }],
  "stakeholders": [{ "name": "optional string", "role": "optional string", "involvement": "optional string" }],
  "budgetInformation": ["string"],
  "timelineInformation": ["string"],
  "decisionCriteria": ["string"],
  "unresolvedQuestions": ["string"],
  "suggestedStage": "DISCOVERY | QUALIFICATION | DEMO | PROPOSAL | NEGOTIATION | CLOSING | WON | LOST",
  "stageReasoning": "string"
}
Use empty arrays when a category has no supported facts. Do not wrap the JSON in prose or markdown.`;

const ANALYSIS_MAX_TOKENS = 4096;
const ANALYSIS_TIMEOUT_MS = 120_000;

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAnalysisMessages(transcript: string): ChatMessage[] {
  return [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${ANALYSIS_SCHEMA_HINT}\n\nSales call transcript begins:\n"""\n${transcript}\n"""`,
    },
  ];
}

async function requestAnalysisCompletion(
  client: OpenAI,
  model: string,
  messages: ChatMessage[],
): Promise<{ content: string; model: string }> {
  const create = (jsonMode: boolean) =>
    client.chat.completions.create(
      {
        model,
        temperature: 0,
        max_tokens: ANALYSIS_MAX_TOKENS,
        messages,
        ...(jsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
      },
      {
        timeout: ANALYSIS_TIMEOUT_MS,
        signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
      },
    );

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await withTimeout(
      create(true),
      ANALYSIS_TIMEOUT_MS + 5_000,
      "OpenRouter analysis request timed out",
    );
  } catch (error) {
    const isFormatIssue =
      error instanceof OpenAI.APIError &&
      error.status === 400 &&
      /response_format|json|structured/i.test(error.message);
    if (!isFormatIssue) {
      throw error;
    }
    completion = await withTimeout(
      create(false),
      ANALYSIS_TIMEOUT_MS + 5_000,
      "OpenRouter analysis request timed out",
    );
  }

  return {
    content: completion.choices[0]?.message?.content ?? "",
    model: completion.model ?? model,
  };
}

/**
 * Analyze a sales call transcript with the configured Nemotron model.
 *
 * The response is validated with Zod. If the first response is invalid, the
 * model is given one correction attempt. A second invalid response is returned
 * as an explicit IntegrationError so callers never persist fabricated analysis.
 */
export async function analyzeTranscript(
  transcript: string,
): Promise<CallAnalysis> {
  const startedAt = Date.now();
  const env = getLlmEnv();
  const client = getLlmClient();
  const messages = buildAnalysisMessages(transcript);

  let lastInvalid: unknown;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result: { content: string; model: string };
    try {
      result = await requestAnalysisCompletion(
        client,
        env.OPENROUTER_MODEL,
        messages,
      );
    } catch (error) {
      const mapped = mapOpenAiError(error);
      const retryable =
        mapped.code === "RATE_LIMITED" ||
        mapped.code === "TIMEOUT" ||
        mapped.code === "PROVIDER_ERROR";
      if (attempt < maxAttempts && retryable) {
        await sleep(mapped.code === "RATE_LIMITED" ? 3_000 : 1_500);
        continue;
      }
      logIntegration({
        service: "llm",
        operation: "analyze_transcript",
        ok: false,
        message: mapped.message,
        code: mapped.code,
        durationMs: Date.now() - startedAt,
        meta: { model: env.OPENROUTER_MODEL, attempt },
      });
      throw mapped;
    }

    try {
      const analysis = parseCallAnalysis(result.content);
      logIntegration({
        service: "llm",
        operation: "analyze_transcript",
        ok: true,
        message: "Transcript analysis validated with Zod",
        durationMs: Date.now() - startedAt,
        meta: {
          model: env.OPENROUTER_MODEL,
          responseModel: result.model,
          attempt,
          factCount:
            analysis.painPoints.length +
            analysis.objections.length +
            analysis.buyingSignals.length +
            analysis.requirements.length +
            analysis.commitments.length +
            analysis.stakeholders.length +
            analysis.budgetInformation.length +
            analysis.timelineInformation.length +
            analysis.decisionCriteria.length +
            analysis.unresolvedQuestions.length,
        },
      });
      return analysis;
    } catch (error) {
      lastInvalid = error;
      logIntegration({
        service: "llm",
        operation: "analyze_transcript_invalid_response",
        ok: false,
        message:
          error instanceof IntegrationError ? error.message : "Unknown error",
        meta: {
          model: env.OPENROUTER_MODEL,
          attempt,
          responsePreview: result.content.slice(0, 800),
        },
      });
      if (attempt < maxAttempts) {
        const issues =
          error instanceof IntegrationError ? error.message : "Unknown error";
        messages.push(
          { role: "assistant", content: result.content },
          {
            role: "user",
            content: `Your previous response could not be accepted (${issues}). Return a corrected JSON object that exactly matches the requested schema. Output only JSON.`,
          },
        );
      }
    }
  }

  const invalid =
    lastInvalid instanceof IntegrationError
      ? lastInvalid
      : new IntegrationError(
          "INVALID_RESPONSE",
          "Model response did not contain valid call analysis",
          "llm",
        );

  logIntegration({
    service: "llm",
    operation: "analyze_transcript",
    ok: false,
    message: invalid.message,
    code: invalid.code,
    durationMs: Date.now() - startedAt,
    meta: { model: env.OPENROUTER_MODEL },
  });

  throw invalid;
}

async function requestCompletion(
  client: OpenAI,
  model: string,
  jsonMode: boolean,
): Promise<{ content: string; model: string }> {
  const completion = await withTimeout(
    client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT },
      ],
      ...(jsonMode
        ? { response_format: { type: "json_object" as const } }
        : {}),
    }, {
      timeout: 60_000,
      signal: AbortSignal.timeout(60_000),
    }),
    65_000,
    "OpenRouter connectivity test timed out",
  );

  return {
    content: completion.choices[0]?.message?.content ?? "",
    model: completion.model ?? model,
  };
}

export async function testLLMConnection(): Promise<ServiceHealth<LlmTestDetails>> {
  const startedAt = Date.now();

  let env: ReturnType<typeof getLlmEnv>;
  try {
    env = getLlmEnv();
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "llm",
      operation: "test_connection",
      ok: false,
      message: safe.message,
      code: safe.code,
    });
    return buildHealth({
      service: "llm",
      status: "configuration_missing",
      message: safe.message,
      startedAt,
      error: safe,
    });
  }

  try {
    const client = getLlmClient();

    // Reasoning models can spend part of the token budget before emitting the
    // JSON body; retry a couple of times on empty/truncated output.
    const MAX_ATTEMPTS = 3;
    let parsed: z.infer<typeof llmResponseSchema> | undefined;
    let completion: { content: string; model: string } | undefined;
    let lastInvalid: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !parsed; attempt += 1) {
      try {
        let result: { content: string; model: string };
        try {
          result = await requestCompletion(client, env.OPENROUTER_MODEL, true);
        } catch (error) {
          const isFormatIssue =
            error instanceof OpenAI.APIError &&
            error.status === 400 &&
            /response_format|json|structured/i.test(error.message);

          if (!isFormatIssue) {
            throw error;
          }

          // Some free models/provider routes reject JSON mode; retry without it.
          result = await requestCompletion(
            client,
            env.OPENROUTER_MODEL,
            false,
          );
        }

        completion = result;
        parsed = llmResponseSchema.parse(extractJson(result.content));
      } catch (error) {
        const retryable =
          error instanceof z.ZodError ||
          (error instanceof IntegrationError &&
            error.code === "INVALID_RESPONSE");

        if (!retryable) {
          throw error;
        }

        lastInvalid = error;
      }
    }

    if (!parsed || !completion) {
      throw (
        lastInvalid ??
        new IntegrationError(
          "INVALID_RESPONSE",
          "Model response did not contain valid JSON",
          "llm",
        )
      );
    }

    const response = parsed;
    const servedModel = completion.model;

    logIntegration({
      service: "llm",
      operation: "test_connection",
      ok: true,
      message: "OpenRouter model responded and validated with Zod",
      durationMs: Date.now() - startedAt,
      meta: { model: env.OPENROUTER_MODEL },
    });

    return buildHealth({
      service: "llm",
      status: "connected",
      message: `Model responded: ${response.message}`,
      startedAt,
      details: {
        requestedModel: env.OPENROUTER_MODEL,
        responseModel: servedModel,
        response,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const safe = {
        code: "INVALID_RESPONSE" as const,
        message: `Model JSON failed validation: ${error.issues
          .map((issue) => issue.path.join(".") || "root")
          .join(", ")}`,
      };
      logIntegration({
        service: "llm",
        operation: "test_connection",
        ok: false,
        message: safe.message,
        code: safe.code,
      });
      return buildHealth({
        service: "llm",
        status: "test_failed",
        message: safe.message,
        startedAt,
        details: { requestedModel: env.OPENROUTER_MODEL },
        error: safe,
      });
    }

    const safe = toSafeError(mapOpenAiError(error));
    logIntegration({
      service: "llm",
      operation: "test_connection",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { model: env.OPENROUTER_MODEL },
    });

    return buildHealth({
      service: "llm",
      status:
        safe.code === "CONFIG_MISSING" ? "configuration_missing" : "test_failed",
      message: safe.message,
      startedAt,
      details: { requestedModel: env.OPENROUTER_MODEL },
      error: safe,
    });
  }
}
