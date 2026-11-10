import { z } from "zod";
import { extractJsonObject } from "@/lib/call-analysis";
import { IntegrationError } from "@/lib/errors";
import {
  CASE_CATEGORY_CODES,
  CASE_SEVERITIES,
  CASE_SUBTYPE_CODES,
  OUTCOME_TYPES,
  STRATEGY_TYPES,
  isValidCaseClassification,
} from "@/lib/case-taxonomy";
import { DEAL_STAGES } from "@/lib/validation";

export const identifiedCaseSchema = z.object({
  categoryCode: z.enum(CASE_CATEGORY_CODES),
  subtypeCode: z.enum(CASE_SUBTYPE_CODES),
  description: z.string().trim().min(1).max(2_000),
  evidence: z.string().trim().max(2_000).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  severity: z.enum(CASE_SEVERITIES).nullable().optional(),
  dealStage: z.enum(DEAL_STAGES).nullable().optional(),
  strategyObserved: z.boolean(),
  strategyName: z.string().trim().max(200).nullable().optional(),
  strategyType: z.enum(STRATEGY_TYPES).nullable().optional(),
  actualApproach: z.string().trim().max(2_000).nullable().optional(),
  strategyEvidence: z.string().trim().max(2_000).nullable().optional(),
  strategyStatus: z.enum(["EXECUTED", "SUGGESTED"]).nullable().optional(),
});

export const caseIdentificationResultSchema = z.object({
  cases: z.array(identifiedCaseSchema).max(8),
});

export type IdentifiedCase = z.infer<typeof identifiedCaseSchema>;

export const outcomeObservationSchema = z.object({
  executionId: z.string().uuid(),
  outcomeType: z.enum(OUTCOME_TYPES),
  evidence: z.string().trim().max(2_000).nullable().optional(),
  isInferred: z.boolean().default(false),
});

export const outcomeObservationResultSchema = z.object({
  outcomes: z.array(outcomeObservationSchema).max(20),
});

export type OutcomeObservation = z.infer<typeof outcomeObservationSchema>;

export function parseCaseIdentification(raw: string): IdentifiedCase[] {
  const parsed = caseIdentificationResultSchema.safeParse(
    extractJsonObject(raw),
  );
  if (!parsed.success) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `Case identification JSON failed validation: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || "root")
        .join(", ")}`,
      "llm",
    );
  }

  return parsed.data.cases.filter((item) =>
    isValidCaseClassification(item.categoryCode, item.subtypeCode),
  );
}

export function parseOutcomeObservations(
  raw: string,
  validExecutionIds: Set<string>,
): OutcomeObservation[] {
  const parsed = outcomeObservationResultSchema.safeParse(
    extractJsonObject(raw),
  );
  if (!parsed.success) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `Outcome observation JSON failed validation: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || "root")
        .join(", ")}`,
      "llm",
    );
  }

  return parsed.data.outcomes.filter((outcome) =>
    validExecutionIds.has(outcome.executionId),
  );
}

export const CASE_IDENTIFICATION_SYSTEM_PROMPT = `You are DealOS, an organizational sales learning engine.

Analyze the latest sales call transcript and extract standardized sales situations ("cases") and what the salesperson actually did.

Rules:
- Use ONLY the supplied category and subtype codes. Never invent a code.
- A case describes a recurring sales situation, not a generic topic.
- Provide exact transcript evidence when available.
- For each case, report whether the salesperson actually performed a strategy in this call.
- Only set strategyObserved=true when the transcript shows the salesperson's action.
- Never treat a customer's hypothetical statement or the assistant's suggestion as an executed strategy.
- Distinguish explicit statements from interpretations.
- Return only JSON. No prose or markdown.

Allowed category codes: ${CASE_CATEGORY_CODES.join(", ")}
Allowed subtype codes: ${CASE_SUBTYPE_CODES.join(", ")}
Allowed strategy types: ${STRATEGY_TYPES.join(", ")}
Allowed severities: ${CASE_SEVERITIES.join(", ")}
Allowed deal stages: ${DEAL_STAGES.join(", ")}`;

export function buildCaseIdentificationPrompt(input: {
  customerName: string;
  productName: string;
  stage: string;
  callNumber: number;
  summary: string;
  transcript: string;
  memories: { category: string; content: string; evidence: string | null }[];
}): string {
  const memories = input.memories.length
    ? input.memories
        .map(
          (memory) =>
            `- (${memory.category}) ${memory.content}${
              memory.evidence ? `\n  evidence: ${memory.evidence}` : ""
            }`,
        )
        .join("\n")
    : "(none)";

  return `Deal: ${input.customerName} - ${input.productName}
Current stage: ${input.stage}
Call number: ${input.callNumber}
Call summary: ${input.summary}

Previously remembered deal context:
${memories}

Transcript:
"""
${input.transcript}
"""

Return JSON with exactly this shape:
{
  "cases": [
    {
      "categoryCode": "PRICE_OBJECTION",
      "subtypeCode": "ROI_UNCLEAR",
      "description": "short standardized situation description",
      "evidence": "exact transcript quote or null",
      "confidence": 0.0,
      "severity": "LOW | MEDIUM | HIGH | null",
      "dealStage": "DISCOVERY | ... | null",
      "strategyObserved": true,
      "strategyName": "short reusable strategy name or null",
      "strategyType": "ROI_JUSTIFICATION | ... | null",
      "actualApproach": "what the salesperson actually did, or null",
      "strategyEvidence": "exact transcript quote or null",
      "strategyStatus": "EXECUTED | SUGGESTED | null"
    }
  ]
}

Return at most 8 cases. If no recurring sales situation is present, return {"cases":[]}.`;
}

export const OUTCOME_OBSERVATION_SYSTEM_PROMPT = `You are DealOS, an organizational sales outcome tracker.

You receive a new sales call and prior strategy executions for the same deal.
Identify only outcomes that are actually observable in the new call.

Rules:
- Use only the supplied execution IDs.
- Do not attribute causality to a strategy merely because the deal progressed.
- Record direct customer responses, meeting bookings, demo acceptance, proposal requests, objection resolution, stage changes, wins or losses.
- Set isInferred=true when the outcome is an interpretation rather than a direct observation.
- Provide transcript evidence when possible.
- Return only JSON. No prose or markdown.`;

export function buildOutcomeObservationPrompt(input: {
  callNumber: number;
  summary: string;
  transcript: string;
  executions: {
    id: string;
    strategyName: string;
    actualApproach: string;
    executedAt: string | null;
    caseCategory: string;
    caseSubtype: string;
    caseDescription: string;
  }[];
}): string {
  const executions = input.executions
    .map(
      (execution) =>
        `[${execution.id}]
Case: ${execution.caseCategory} / ${execution.caseSubtype}
Situation: ${execution.caseDescription}
Strategy: ${execution.strategyName}
Actual approach: ${execution.actualApproach}
Executed at: ${execution.executedAt ?? "unknown"}`,
    )
    .join("\n\n");

  return `New call number: ${input.callNumber}
New call summary: ${input.summary}

Prior strategy executions awaiting outcomes:
${executions}

New transcript:
"""
${input.transcript}
"""

Return JSON with exactly this shape:
{
  "outcomes": [
    {
      "executionId": "id from the list",
      "outcomeType": "POSITIVE_RESPONSE | MEETING_BOOKED | DEMO_ACCEPTED | PROPOSAL_REQUESTED | OBJECTION_RESOLVED | DEAL_ADVANCED | DEAL_WON | DEAL_LOST | NO_CHANGE | UNKNOWN",
      "evidence": "exact transcript quote or null",
      "isInferred": false
    }
  ]
}

Only include executions with an observable outcome. Return {"outcomes":[]} when nothing is observable.`;
}
