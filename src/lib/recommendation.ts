import { z } from "zod";
import { extractJsonObject } from "@/lib/call-analysis";
import { IntegrationError } from "@/lib/errors";
import type { FactCategory } from "@/types/deal";

export const recommendationOutputSchema = z.object({
  action: z.string().trim().min(1).max(2_000),
  reasoning: z.string().trim().min(1).max(4_000),
  uncertainty: z.string().trim().max(2_000).nullable().optional(),
  nextStep: z.string().trim().max(2_000).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  influencingMemories: z
    .array(
      z.object({
        memoryId: z.string().uuid(),
        contribution: z.string().trim().min(1).max(1_000),
      }),
    )
    .min(1),
  relevantTechniqueIds: z.array(z.string().uuid()).optional().default([]),
  organizationalEvidence: z.string().trim().max(2_000).nullable().optional(),
  recommendedStrategyName: z.string().trim().max(200).nullable().optional(),
});

export type RecommendationOutput = z.infer<typeof recommendationOutputSchema>;

export interface RecommendationMemoryInput {
  id: string;
  category: FactCategory;
  content: string;
  evidence: string | null;
  confidence: number | null;
  callNumber: number;
}

export interface RecommendationCaseInput {
  id: string;
  categoryCode: string;
  categoryName: string;
  subtype: string;
  description: string;
  evidence: string | null;
}

export interface RecommendationPlaybookInput {
  id: string;
  versionId: string;
  title: string;
  guidance: string;
  conditions: string;
  exceptions: string;
  evidenceSummary: string;
  confidence: number | null;
  strategyName: string | null;
  strategyId: string | null;
  evidenceCount: number;
}

export interface RecommendationTechniqueInput {
  id: string;
  name: string;
  description: string;
  source: string | null;
  memoryId: string | null;
}

export function parseRecommendation(raw: string): RecommendationOutput {
  const parsed = recommendationOutputSchema.safeParse(extractJsonObject(raw));
  if (!parsed.success) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `Recommendation JSON failed validation: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || "root")
        .join(", ")}`,
      "llm",
    );
  }
  return parsed.data;
}

export const RECOMMENDATION_SYSTEM_PROMPT = `You are DealOS, an experience-driven sales intelligence agent.

You recommend the next sales action for a specific deal using only the supplied deal memories and personal techniques.

Rules:
- Recommend one concrete next action for the salesperson.
- Explain why it follows from the deal's actual memories.
- Cite at least one influencing memory by ID. Never invent an ID.
- Cite personal techniques only when they are directly relevant.
- Be explicit about uncertainty.
- Do not claim that an action has already happened. This is a suggestion.
- Do not invent customer information.
- Use the approved organizational playbook only when it matches the identified case context.
- If the playbook does not fit this customer, recommend a different approach and explain why.
- Separate deal-specific evidence from organizational evidence.
- Return only JSON. No prose or markdown.`;

export function buildRecommendationPrompt(params: {
  customerName: string;
  productName: string;
  stage: string;
  callNumber: number;
  summary: string;
  memories: RecommendationMemoryInput[];
  techniques: RecommendationTechniqueInput[];
  caseContext?: RecommendationCaseInput | null;
  playbook?: RecommendationPlaybookInput | null;
  organizationalRecall?: string[];
}): string {
  const memories = params.memories
    .map(
      (memory) =>
        `[${memory.id}] (${memory.category}, Call ${memory.callNumber}) ${memory.content}${
          memory.evidence ? `\n  evidence: ${memory.evidence}` : ""
        }`,
    )
    .join("\n");

  const techniques = params.techniques.length
    ? params.techniques
        .map(
          (technique) =>
            `[${technique.id}] ${technique.name}: ${technique.description}${
              technique.source ? ` (source: ${technique.source})` : ""
            }`,
        )
        .join("\n")
    : "(none)";

  const caseContext = params.caseContext
    ? `${params.caseContext.categoryName} (${params.caseContext.categoryCode}) / ${
        params.caseContext.subtype
      }
Situation: ${params.caseContext.description}
Evidence: ${params.caseContext.evidence ?? "not recorded"}`
    : "(no standardized case identified)";

  const playbook = params.playbook
    ? `Title: ${params.playbook.title}
Recommended strategy: ${params.playbook.strategyName ?? "not selected"}
Evidence count: ${params.playbook.evidenceCount}
Confidence: ${params.playbook.confidence ?? "unspecified"}
Guidance: ${params.playbook.guidance}
When to use: ${params.playbook.conditions}
When not to use / exceptions: ${params.playbook.exceptions}
Evidence summary: ${params.playbook.evidenceSummary}`
    : "(no approved organizational playbook matched this case)";

  const recall = params.organizationalRecall?.length
    ? params.organizationalRecall.map((item) => `- ${item}`).join("\n")
    : "(none)";

  return `Deal: ${params.customerName} - ${params.productName}
Current stage: ${params.stage}
Latest call: Call ${params.callNumber}
Latest call summary: ${params.summary}

Identified organizational case:
${caseContext}

Approved organizational playbook:
${playbook}

Walrus organizational memory recall (supporting context only):
${recall}

Deal memories:
${memories}

Personal techniques:
${techniques}

Return JSON with exactly this shape:
{
  "action": "one concrete next action",
  "reasoning": "why this action follows from the memories",
  "uncertainty": "what is unknown or risky, or null",
  "nextStep": "the immediate follow-up step",
  "confidence": 0.0,
  "influencingMemories": [
    { "memoryId": "id from the list", "contribution": "how it influenced the action" }
  ],
  "relevantTechniqueIds": ["technique id from the list"],
  "organizationalEvidence": "what the organizational playbook or recall contributes, or null",
  "recommendedStrategyName": "the strategy name you recommend, or null"
}`;
}
