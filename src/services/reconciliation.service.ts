import OpenAI from "openai";
import { getLlmClient, getLlmEnv } from "@/lib/llm";
import { toSafeError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import { withTimeout } from "@/lib/with-timeout";
import {
  buildReconciliationPrompt,
  parseReconciliation,
  RECONCILIATION_SYSTEM_PROMPT,
  type ExistingMemory,
  type NormalizedReconciliation,
  type ReconciliationCandidate,
} from "@/lib/memory-reconciliation";
import { prisma } from "@/lib/prisma";
import { recallDealMemories } from "@/services/memory.service";
import type { FactCategory } from "@/types/deal";

const MAX_MEMORIES = 60;
const MAX_RECALL = 8;
const MAX_TOKENS = 4_096;
const TIMEOUT_MS = 120_000;

function createAllDecisions(
  candidates: ReconciliationCandidate[],
  reason: string,
): NormalizedReconciliation[] {
  return candidates.map((candidate, index) => ({
    candidateIndex: index,
    action: "CREATE",
    targetMemoryId: null,
    refinedContent: null,
    refinedEvidence: null,
    reason: `${reason} (${candidate.category})`,
  }));
}

async function requestReconciliation(
  prompt: string,
): Promise<{ content: string; model: string }> {
  const env = getLlmEnv();
  const client = getLlmClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: RECONCILIATION_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  const create = (jsonMode: boolean) =>
    client.chat.completions.create(
      {
        model: env.OPENROUTER_MODEL,
        temperature: 0,
        max_tokens: MAX_TOKENS,
        messages,
        ...(jsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
      },
      {
        timeout: TIMEOUT_MS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await withTimeout(
      create(true),
      TIMEOUT_MS + 5_000,
      "Memory reconciliation request timed out",
    );
  } catch (error) {
    const isFormatIssue =
      error instanceof OpenAI.APIError &&
      error.status === 400 &&
      /response_format|json|structured/i.test(error.message);
    if (!isFormatIssue) throw error;
    completion = await withTimeout(
      create(false),
      TIMEOUT_MS + 5_000,
      "Memory reconciliation request timed out",
    );
  }

  return {
    content: completion.choices[0]?.message?.content ?? "",
    model: completion.model ?? env.OPENROUTER_MODEL,
  };
}

export interface ReconcileCallInput {
  dealId: string;
  callId: string;
  callNumber: number;
  summary: string;
  candidates: ReconciliationCandidate[];
}

/**
 * Compare newly extracted facts with the deal's existing memories.
 *
 * PostgreSQL memories are the reconciliation targets. Walrus recall is added as
 * supporting semantic context, never as a source of memory IDs. When there are
 * no existing memories there is nothing to compare, so every candidate is a
 * CREATE. A reconciliation failure never silently claims a memory was confirmed
 * or refined: candidates fall back to CREATE with the failure recorded as the
 * reason.
 */
export async function reconcileCallMemories(
  input: ReconcileCallInput,
): Promise<NormalizedReconciliation[]> {
  const startedAt = Date.now();

  if (input.candidates.length === 0) return [];

  const existing = await prisma.extractedFact.findMany({
    where: { dealId: input.dealId },
    orderBy: { updatedAt: "desc" },
    take: MAX_MEMORIES,
    select: {
      id: true,
      category: true,
      content: true,
      evidence: true,
    },
  });

  const existingMemories: ExistingMemory[] = existing.map((memory) => ({
    id: memory.id,
    category: memory.category as FactCategory,
    content: memory.content,
    evidence: memory.evidence,
  }));

  if (existingMemories.length === 0) {
    logIntegration({
      service: "llm",
      operation: "reconcile_call_memories",
      ok: true,
      message: "No existing memories; all candidates created",
      meta: { dealId: input.dealId, callId: input.callId, candidates: input.candidates.length },
    });
    return createAllDecisions(input.candidates, "No existing deal memories");
  }

  let semanticRecall: string[] = [];
  try {
    const recall = await recallDealMemories(
      input.dealId,
      `${input.summary} ${input.candidates.map((candidate) => candidate.content).join(" ")}`,
      MAX_RECALL,
    );
    semanticRecall = recall.results.map((memory) =>
      memory.text.replace(/\s+/g, " ").slice(0, 400),
    );
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "walrus",
      operation: "recall_for_reconciliation",
      ok: false,
      message: safe.message,
      code: safe.code,
      meta: { dealId: input.dealId, callId: input.callId },
    });
  }

  const prompt = buildReconciliationPrompt({
    callNumber: input.callNumber,
    summary: input.summary,
    candidates: input.candidates,
    existingMemories,
    semanticRecall,
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await requestReconciliation(prompt);
      const decisions = parseReconciliation(
        result.content,
        input.candidates,
        existingMemories,
      );

      logIntegration({
        service: "llm",
        operation: "reconcile_call_memories",
        ok: true,
        message: "Call facts reconciled against existing deal memories",
        durationMs: Date.now() - startedAt,
        meta: {
          dealId: input.dealId,
          callId: input.callId,
          model: result.model,
          attempt,
          decisions: decisions.map((decision) => decision.action),
        },
      });

      return decisions;
    } catch (error) {
      lastError = error;
    }
  }

  const safe = toSafeError(lastError);
  logIntegration({
    service: "llm",
    operation: "reconcile_call_memories",
    ok: false,
    message: safe.message,
    code: safe.code,
    durationMs: Date.now() - startedAt,
    meta: { dealId: input.dealId, callId: input.callId },
  });

  return createAllDecisions(
    input.candidates,
    `Reconciliation unavailable: ${safe.message}`,
  );
}
