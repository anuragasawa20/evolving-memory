import { z } from "zod";
import { extractJsonObject } from "@/lib/call-analysis";
import { IntegrationError } from "@/lib/errors";
import { FACT_CATEGORIES } from "@/lib/validation";
import type { FactCategory } from "@/types/deal";

export const RECONCILIATION_ACTIONS = [
  "CREATE",
  "CONFIRM",
  "REFINE",
  "CONTRADICT",
] as const;

export type ReconciliationAction = (typeof RECONCILIATION_ACTIONS)[number];

export const reconciliationDecisionSchema = z.object({
  candidateIndex: z.number().int().nonnegative(),
  action: z.enum(RECONCILIATION_ACTIONS),
  targetMemoryId: z.string().uuid().nullable().optional(),
  refinedContent: z.string().trim().min(1).max(4_000).nullable().optional(),
  refinedEvidence: z.string().trim().min(1).max(4_000).nullable().optional(),
  reason: z.string().trim().min(1).max(2_000),
});

export const reconciliationResultSchema = z.object({
  decisions: z.array(reconciliationDecisionSchema),
});

export type ReconciliationDecision = z.infer<
  typeof reconciliationDecisionSchema
>;

export interface ReconciliationCandidate {
  category: FactCategory;
  content: string;
  evidence: string | null;
  isInferred: boolean;
  confidence?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface ExistingMemory {
  id: string;
  category: FactCategory;
  content: string;
  evidence: string | null;
}

export interface NormalizedReconciliation {
  candidateIndex: number;
  action: ReconciliationAction;
  targetMemoryId: string | null;
  refinedContent: string | null;
  refinedEvidence: string | null;
  reason: string;
}

export function normalizeReconciliation(
  decisions: ReconciliationDecision[],
  candidates: ReconciliationCandidate[],
  existingMemories: ExistingMemory[],
): NormalizedReconciliation[] {
  const validMemoryIds = new Set(existingMemories.map((memory) => memory.id));
  const byIndex = new Map<number, NormalizedReconciliation>();

  for (const decision of decisions) {
    if (decision.candidateIndex >= candidates.length) continue;
    if (byIndex.has(decision.candidateIndex)) continue;

    let action = decision.action;
    let targetMemoryId = decision.targetMemoryId ?? null;

    if (action !== "CREATE") {
      if (!targetMemoryId || !validMemoryIds.has(targetMemoryId)) {
        action = "CREATE";
        targetMemoryId = null;
      }
    }

    if (action === "CONFIRM" || action === "REFINE" || action === "CONTRADICT") {
      if (!targetMemoryId) {
        action = "CREATE";
      }
    }

    byIndex.set(decision.candidateIndex, {
      candidateIndex: decision.candidateIndex,
      action,
      targetMemoryId,
      refinedContent:
        action === "REFINE"
          ? (decision.refinedContent ?? candidates[decision.candidateIndex].content)
          : null,
      refinedEvidence:
        action === "REFINE"
          ? (decision.refinedEvidence ??
            candidates[decision.candidateIndex].evidence)
          : null,
      reason: decision.reason,
    });
  }

  return candidates.map((_, index) => {
    return (
      byIndex.get(index) ?? {
        candidateIndex: index,
        action: "CREATE",
        targetMemoryId: null,
        refinedContent: null,
        refinedEvidence: null,
        reason: "No reconciliation decision was returned for this candidate.",
      }
    );
  });
}

export function parseReconciliation(
  raw: string,
  candidates: ReconciliationCandidate[],
  existingMemories: ExistingMemory[],
): NormalizedReconciliation[] {
  const parsed = reconciliationResultSchema.safeParse(extractJsonObject(raw));
  if (!parsed.success) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `Memory reconciliation JSON failed validation: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || "root")
        .join(", ")}`,
      "llm",
    );
  }

  return normalizeReconciliation(
    parsed.data.decisions,
    candidates,
    existingMemories,
  );
}

export const RECONCILIATION_SYSTEM_PROMPT = `You are DealOS, a sales memory reconciliation engine.

You compare newly extracted facts from the latest sales call with the deal's existing memories.

Your job is to decide whether each new candidate fact:
- CREATE: introduces genuinely new knowledge.
- CONFIRM: restates an existing memory and adds new supporting evidence.
- REFINE: improves, clarifies or corrects an existing memory.
- CONTRADICT: conflicts with an existing memory and needs to be surfaced.

Rules:
- Compare meaning, not exact wording.
- Use only the existing memory IDs supplied. Never invent an ID.
- Return exactly one decision per candidate index.
- For CONFIRM, keep the existing memory's content and attach the new evidence.
- For REFINE, provide the improved content and evidence.
- For CONTRADICT, explain the conflict.
- Do not treat every extracted fact as a new memory.
- Do not claim a fact is confirmed without supporting evidence.
- Return only JSON. No prose or markdown.`;

export function buildReconciliationPrompt(params: {
  callNumber: number;
  summary: string;
  candidates: ReconciliationCandidate[];
  existingMemories: ExistingMemory[];
  semanticRecall: string[];
}): string {
  const existing = params.existingMemories.length
    ? params.existingMemories
        .map(
          (memory) =>
            `[${memory.id}] (${memory.category}) ${memory.content}${
              memory.evidence ? `\n  evidence: ${memory.evidence}` : ""
            }`,
        )
        .join("\n")
    : "(none)";

  const candidates = params.candidates
    .map(
      (candidate, index) =>
        `[${index}] (${candidate.category}) ${candidate.content}${
          candidate.evidence ? `\n  evidence: ${candidate.evidence}` : ""
        }`,
    )
    .join("\n");

  const recall = params.semanticRecall.length
    ? params.semanticRecall.map((text) => `- ${text}`).join("\n")
    : "(none)";

  return `Call number: ${params.callNumber}
Call summary: ${params.summary}

Existing deal memories:
${existing}

Semantic recall context from Walrus Memory (supporting context only; do not create IDs from it):
${recall}

New candidate facts from this call:
${candidates}

Return JSON with exactly this shape:
{
  "decisions": [
    {
      "candidateIndex": 0,
      "action": "CREATE | CONFIRM | REFINE | CONTRADICT",
      "targetMemoryId": "existing memory id or null",
      "refinedContent": "required only for REFINE, otherwise null",
      "refinedEvidence": "optional refined evidence, otherwise null",
      "reason": "short explanation grounded in the supplied facts"
    }
  ]
}

Allowed categories: ${FACT_CATEGORIES.join(", ")}.`;
}
