import { z } from "zod";
import { extractJsonObject } from "@/lib/call-analysis";
import { IntegrationError } from "@/lib/errors";

export const playbookSynthesisSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2_000),
  guidance: z.string().trim().min(1).max(4_000),
  whenToUse: z.string().trim().min(1).max(2_000),
  whenNotToUse: z.string().trim().min(1).max(2_000),
  suggestedQuestions: z.array(z.string().trim().min(1).max(500)).max(10),
  exceptions: z.string().trim().max(2_000),
  recommendedStrategyId: z.string().uuid().nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export type PlaybookSynthesis = z.infer<typeof playbookSynthesisSchema>;

export function parsePlaybookSynthesis(raw: string): PlaybookSynthesis {
  const parsed = playbookSynthesisSchema.safeParse(extractJsonObject(raw));
  if (!parsed.success) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      `Playbook synthesis JSON failed validation: ${parsed.error.issues
        .map((issue) => issue.path.join(".") || "root")
        .join(", ")}`,
      "llm",
    );
  }
  return parsed.data;
}

export const PLAYBOOK_SYNTHESIS_SYSTEM_PROMPT = `You are DealOS, an organizational sales learning engine.

You synthesize evidence-backed playbooks from aggregated, de-identified case outcomes.

Rules:
- Use only the supplied evidence and counts.
- Do not claim universal winners. Write conditional guidance.
- Distinguish sample size, context and evidence quality.
- Prefer a strategy supported by more comparable executions and complete outcomes, not simply the highest positive count.
- Mention exceptions and uncertainty.
- Never include customer names or raw transcript text.
- Recommend a strategy only from the supplied strategy IDs.
- Return only JSON. No prose or markdown.`;

export function buildPlaybookPrompt(input: {
  organizationName: string;
  categoryCode: string;
  categoryName: string;
  subtype: string;
  totalCases: number;
  strategies: {
    id: string;
    name: string;
    type: string;
    executions: number;
    positive: number;
    negative: number;
    neutral: number;
    pending: number;
    contexts: string[];
  }[];
}): string {
  const strategies = input.strategies
    .map(
      (strategy) =>
        `[${strategy.id}] ${strategy.name} (${strategy.type})
  executions: ${strategy.executions}
  positive outcomes: ${strategy.positive}
  negative outcomes: ${strategy.negative}
  neutral outcomes: ${strategy.neutral}
  pending outcomes: ${strategy.pending}
  contexts: ${strategy.contexts.join("; ") || "not recorded"}`,
    )
    .join("\n\n");

  return `Organization: ${input.organizationName}
Case category: ${input.categoryName} (${input.categoryCode})
Case subtype: ${input.subtype}
Comparable cases: ${input.totalCases}

Strategy evidence:
${strategies || "(no strategy executions recorded)"}

Return JSON with exactly this shape:
{
  "title": "short playbook title",
  "description": "situation description",
  "guidance": "recommended approach, written as conditional guidance",
  "whenToUse": "conditions where this strategy fits",
  "whenNotToUse": "conditions where it should not be used",
  "suggestedQuestions": ["question the salesperson should ask"],
  "exceptions": "known exceptions or limitations",
  "recommendedStrategyId": "strategy id from the list or null",
  "confidence": 0.0
}

Keep confidence consistent with sample size and outcome completeness.`;
}
