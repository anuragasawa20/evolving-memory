import { describe, expect, it } from "vitest";
import {
  normalizeReconciliation,
  parseReconciliation,
  type ExistingMemory,
  type ReconciliationCandidate,
} from "@/lib/memory-reconciliation";

const existingId = "11111111-1111-4111-8111-111111111111";

const candidates: ReconciliationCandidate[] = [
  {
    category: "PAIN_POINT",
    content: "Payment follow-ups are manual.",
    evidence: "Staff call customers manually.",
    isInferred: false,
  },
  {
    category: "OBJECTION",
    content: "Migration risk.",
    evidence: null,
    isInferred: true,
  },
];

const existing: ExistingMemory[] = [
  {
    id: existingId,
    category: "PAIN_POINT",
    content: "Manual payment follow-ups consume staff time.",
    evidence: "Older quote.",
  },
];

describe("memory reconciliation normalization", () => {
  it("keeps valid CONFIRM and REFINE decisions with their target memory", () => {
    const normalized = normalizeReconciliation(
      [
        {
          candidateIndex: 0,
          action: "CONFIRM",
          targetMemoryId: existingId,
          reason: "Same pain point with new evidence.",
        },
        {
          candidateIndex: 1,
          action: "REFINE",
          targetMemoryId: existingId,
          refinedContent: "Sharper migration concern.",
          refinedEvidence: "New quote.",
          reason: "Understanding improved.",
        },
      ],
      candidates,
      existing,
    );

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toMatchObject({
      action: "CONFIRM",
      targetMemoryId: existingId,
    });
    expect(normalized[1]).toMatchObject({
      action: "REFINE",
      targetMemoryId: existingId,
      refinedContent: "Sharper migration concern.",
      refinedEvidence: "New quote.",
    });
  });

  it("downgrades an invented target memory to CREATE", () => {
    const normalized = normalizeReconciliation(
      [
        {
          candidateIndex: 0,
          action: "CONFIRM",
          targetMemoryId: "22222222-2222-4222-8222-222222222222",
          reason: "Unsupported target.",
        },
      ],
      candidates,
      existing,
    );

    expect(normalized[0]).toMatchObject({
      action: "CREATE",
      targetMemoryId: null,
    });
  });

  it("fills missing candidates with an explicit CREATE fallback", () => {
    const normalized = normalizeReconciliation([], candidates, existing);
    expect(normalized).toHaveLength(2);
    expect(normalized.every((decision) => decision.action === "CREATE")).toBe(
      true,
    );
    expect(normalized[0].reason).toContain("No reconciliation decision");
  });

  it("parses fenced JSON decisions and preserves candidate evidence for REFINE", () => {
    const raw = `\`\`\`json
{"decisions":[{"candidateIndex":1,"action":"REFINE","targetMemoryId":"${existingId}","reason":"Clarified"}]}
\`\`\``;
    const normalized = parseReconciliation(raw, candidates, existing);
    expect(normalized[1]).toMatchObject({
      action: "REFINE",
      refinedContent: candidates[1].content,
      refinedEvidence: candidates[1].evidence,
    });
  });

  it("rejects invalid reconciliation JSON", () => {
    expect(() => parseReconciliation("not json", candidates, existing)).toThrow(
      /did not contain valid JSON|failed validation/i,
    );
  });
});
