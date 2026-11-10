import { describe, expect, it } from "vitest";
import {
  buildCaseMemoryText,
  buildPlaybookMemoryText,
  buildTechniqueMemoryText,
} from "@/services/organization-memory.service";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("organizational Walrus memory text", () => {
  it("builds a case memory with provenance, strategy and outcome but no raw transcript", () => {
    const text = buildCaseMemoryText({
      organizationId,
      caseInstance: {
        id: "22222222-2222-4222-8222-222222222222",
        subtype: "ROI_UNCLEAR",
        description:
          "The buyer cannot see the financial return and needs a CFO-ready business case.",
        evidence: "I cannot show my CFO the return.",
        confidence: null,
        dealStage: "DISCOVERY",
        severity: "HIGH",
        isSynthetic: true,
        createdAt: new Date("2026-11-01T10:00:00Z"),
      },
      categoryCode: "PRICE_OBJECTION",
      categoryName: "Price objection",
      deal: {
        id: "33333333-3333-4333-8333-333333333333",
        productName: "Gym Management Software",
        stage: "DISCOVERY",
      },
      call: {
        id: "44444444-4444-4444-8444-444444444444",
        callNumber: 2,
        callDate: new Date("2026-11-01T10:00:00Z"),
      },
      salesperson: { name: "Ava Chen" },
      executions: [
        {
          executionStatus: "OUTCOME_RECORDED",
          actualApproach: "Quantified 18 weekly staff hours against the annual cost.",
          strategyName: "ROI justification",
          strategyType: "ROI_JUSTIFICATION",
          outcomes: [
            {
              outcomeType: "DEMO_ACCEPTED",
              evidence: "Let's schedule the demo.",
              isInferred: false,
            },
          ],
        },
      ],
    });

    expect(text).toContain(`Org ID: ${organizationId}`);
    expect(text).toContain("Case code: PRICE_OBJECTION");
    expect(text).toContain("Case subtype: ROI_UNCLEAR");
    expect(text).toContain("ROI justification");
    expect(text).toContain("DEMO_ACCEPTED");
    expect(text).toContain("Synthetic dataset: yes");
    expect(text).toContain("does not contain the raw transcript");
    expect(text).not.toContain("Full transcript");
  });

  it("builds a playbook memory from de-identified guidance", () => {
    const text = buildPlaybookMemoryText({
      organizationId,
      playbook: {
        id: "55555555-5555-4555-8555-555555555555",
        title: "ROI justification for unclear value",
        description: "Conditional guidance for ROI objections.",
        status: "ACTIVE",
        currentVersion: 2,
      },
      version: {
        id: "66666666-6666-4666-8666-666666666666",
        version: 2,
        guidance: "Co-create the ROI model with the buyer before presenting numbers.",
        conditions: "Use when the buyer understands the problem but not the value.",
        exceptions: "Do not use when budget authority is absent.",
        evidenceSummary: "3 comparable cases, 2 positive outcomes.",
        confidence: null,
        approvalStatus: "APPROVED",
      },
      categoryCode: "PRICE_OBJECTION",
      categoryName: "Price objection",
      subtype: "ROI_UNCLEAR",
      strategy: {
        name: "ROI justification",
        description: "Quantify operational cost.",
        strategyType: "ROI_JUSTIFICATION",
      },
      evidenceCount: 5,
    });

    expect(text).toContain(`Org ID: ${organizationId}`);
    expect(text).toContain("Organizational playbook version");
    expect(text).toContain("ROI justification");
    expect(text).toContain("Evidence items: 5");
    expect(text).toContain("contains no raw transcript or customer name");
  });

  it("builds a personal learning memory scoped to the organization", () => {
    const text = buildTechniqueMemoryText({
      organizationId,
      technique: {
        id: "77777777-7777-4777-8777-777777777777",
        name: "ROI-first discovery",
        description: "Ask for the operational cost before defending price.",
        source: "Book",
        createdAt: new Date("2026-11-02T10:00:00Z"),
      },
    });

    expect(text).toContain(`Org ID: ${organizationId}`);
    expect(text).toContain("Personal learning technique");
    expect(text).toContain("ROI-first discovery");
    expect(text).toContain("personal learning memory owned by the salesperson");
  });
});
