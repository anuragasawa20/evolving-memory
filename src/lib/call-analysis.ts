import { z } from "zod";
import { IntegrationError } from "@/lib/errors";
import { DEAL_STAGES } from "@/lib/validation";
import type { FactCategory } from "@/types/deal";

const evidenceItemSchema = z.object({
  content: z.string().trim().min(1),
  evidence: z.string().trim().min(1).optional(),
  inferred: z.boolean().optional(),
});

const objectionSchema = evidenceItemSchema.extend({
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

const stakeholderSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: z.string().trim().min(1).optional(),
  involvement: z.string().trim().min(1).optional(),
});

export const callAnalysisSchema = z.object({
  summary: z.string().trim().min(1),
  painPoints: z.array(evidenceItemSchema),
  objections: z.array(objectionSchema),
  buyingSignals: z.array(evidenceItemSchema),
  requirements: z.array(evidenceItemSchema),
  commitments: z.array(evidenceItemSchema),
  stakeholders: z.array(stakeholderSchema),
  budgetInformation: z.array(z.string().trim().min(1)),
  timelineInformation: z.array(z.string().trim().min(1)),
  decisionCriteria: z.array(z.string().trim().min(1)),
  unresolvedQuestions: z.array(z.string().trim().min(1)),
  suggestedStage: z.string().trim().min(1),
  stageReasoning: z.string().trim().min(1),
});

export type CallAnalysis = z.infer<typeof callAnalysisSchema>;

export interface AnalysisFactInput {
  category: FactCategory;
  content: string;
  evidence?: string;
  isInferred: boolean;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
}

export function extractJsonObject(text: string): unknown {
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

function cleanString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function cleanEvidenceItems(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = { ...(item as Record<string, unknown>) };
      record.content = cleanString(record.content);
      if (record.evidence === null) delete record.evidence;
      if (typeof record.evidence === "string") {
        const evidence = record.evidence.trim();
        if (evidence) record.evidence = evidence;
        else delete record.evidence;
      }
      if (typeof record.inferred !== "boolean") delete record.inferred;
      if (!record.content) return null;
      return record;
    })
    .filter((item): item is Record<string, unknown> => item !== null);
}

function cleanObjections(value: unknown): unknown[] {
  return cleanEvidenceItems(value).map((item) => {
    const record = { ...item };
    if (record.severity === null || record.severity === "") {
      delete record.severity;
    }
    return record;
  });
}

function cleanStakeholders(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = { ...(item as Record<string, unknown>) };
      for (const key of ["name", "role", "involvement"]) {
        if (record[key] === null) {
          delete record[key];
          continue;
        }
        if (typeof record[key] === "string") {
          const cleaned = (record[key] as string).trim();
          if (cleaned) record[key] = cleaned;
          else delete record[key];
        }
      }
      if (!record.name && !record.role && !record.involvement) return null;
      return record;
    })
    .filter((item): item is Record<string, unknown> => item !== null);
}

function sanitizeAnalysisPayload(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = { ...record };

  if (typeof record.summary === "string") {
    result.summary = record.summary.trim();
  }
  if (Array.isArray(record.painPoints)) {
    result.painPoints = cleanEvidenceItems(record.painPoints);
  }
  if (Array.isArray(record.objections)) {
    result.objections = cleanObjections(record.objections);
  }
  if (Array.isArray(record.buyingSignals)) {
    result.buyingSignals = cleanEvidenceItems(record.buyingSignals);
  }
  if (Array.isArray(record.requirements)) {
    result.requirements = cleanEvidenceItems(record.requirements);
  }
  if (Array.isArray(record.commitments)) {
    result.commitments = cleanEvidenceItems(record.commitments);
  }
  if (Array.isArray(record.stakeholders)) {
    result.stakeholders = cleanStakeholders(record.stakeholders);
  }
  if (Array.isArray(record.budgetInformation)) {
    result.budgetInformation = cleanStringArray(record.budgetInformation);
  }
  if (Array.isArray(record.timelineInformation)) {
    result.timelineInformation = cleanStringArray(record.timelineInformation);
  }
  if (Array.isArray(record.decisionCriteria)) {
    result.decisionCriteria = cleanStringArray(record.decisionCriteria);
  }
  if (Array.isArray(record.unresolvedQuestions)) {
    result.unresolvedQuestions = cleanStringArray(record.unresolvedQuestions);
  }
  if (typeof record.suggestedStage === "string") {
    result.suggestedStage = record.suggestedStage.trim();
  }
  if (typeof record.stageReasoning === "string") {
    result.stageReasoning = record.stageReasoning.trim();
  }

  return result;
}

export function parseCallAnalysis(raw: string): CallAnalysis {
  const parsed = callAnalysisSchema.safeParse(
    sanitizeAnalysisPayload(extractJsonObject(raw)),
  );
  if (!parsed.success) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `Model JSON failed analysis validation: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || "root")
        .join(", ")}`,
      "llm",
    );
  }
  return parsed.data;
}

export function normalizeSuggestedStage(value: string): (typeof DEAL_STAGES)[number] | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (DEAL_STAGES as readonly string[]).includes(normalized)
    ? (normalized as (typeof DEAL_STAGES)[number])
    : null;
}

export function analysisToFactInputs(
  analysis: CallAnalysis,
): AnalysisFactInput[] {
  const facts: AnalysisFactInput[] = [];

  for (const item of analysis.painPoints) {
    facts.push({
      category: "PAIN_POINT",
      content: item.content,
      evidence: item.evidence,
      isInferred: item.inferred ?? !item.evidence,
    });
  }

  for (const item of analysis.objections) {
    facts.push({
      category: "OBJECTION",
      content: item.content,
      evidence: item.evidence,
      isInferred: item.inferred ?? !item.evidence,
      metadata: item.severity ? { severity: item.severity } : undefined,
    });
  }

  for (const item of analysis.buyingSignals) {
    facts.push({
      category: "BUYING_SIGNAL",
      content: item.content,
      evidence: item.evidence,
      isInferred: item.inferred ?? !item.evidence,
    });
  }

  for (const item of analysis.requirements) {
    facts.push({
      category: "REQUIREMENT",
      content: item.content,
      evidence: item.evidence,
      isInferred: item.inferred ?? !item.evidence,
    });
  }

  for (const item of analysis.commitments) {
    facts.push({
      category: "COMMITMENT",
      content: item.content,
      evidence: item.evidence,
      isInferred: item.inferred ?? !item.evidence,
    });
  }

  for (const stakeholder of analysis.stakeholders) {
    const label = stakeholder.name ?? "Unnamed stakeholder";
    const parts = [
      stakeholder.role ? `Role: ${stakeholder.role}` : null,
      stakeholder.involvement
        ? `Involvement: ${stakeholder.involvement}`
        : null,
    ].filter(Boolean);

    facts.push({
      category: "STAKEHOLDER",
      content: parts.length ? `${label}. ${parts.join(". ")}` : label,
      isInferred: false,
      metadata: {
        kind: "stakeholder",
        name: stakeholder.name ?? null,
        role: stakeholder.role ?? null,
        involvement: stakeholder.involvement ?? null,
      },
    });
  }

  const listFacts = (
    values: string[],
    category: FactCategory,
    kind: string,
  ) => {
    for (const content of values) {
      facts.push({ category, content, isInferred: false, metadata: { kind } });
    }
  };

  listFacts(analysis.budgetInformation, "BUDGET", "budget");
  listFacts(analysis.timelineInformation, "TIMELINE", "timeline");
  listFacts(analysis.decisionCriteria, "DECISION_CRITERIA", "decision_criteria");
  listFacts(analysis.unresolvedQuestions, "OTHER", "unresolved_question");

  return facts;
}
