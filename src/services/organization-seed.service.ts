import type { OutcomeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCaseTaxonomy, getDefaultOrganizationContext } from "@/services/organization.service";
import {
  syncCaseInstanceMemory,
  syncPersonalTechniqueMemory,
} from "@/services/organization-memory.service";
import { createPlaybookDraft } from "@/services/organizational-intelligence.service";
import type { DealStage } from "@/types/deal";

interface SeedExecution {
  strategyName: string;
  strategyType: string;
  approach: string;
  outcomeType?: string;
  outcomeEvidence?: string;
}

interface SeedCase {
  customer: string;
  salesperson: string;
  stage: DealStage;
  categoryCode: string;
  subtype: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  evidence: string;
  confidence: number;
  daysAgo: number;
  executions: SeedExecution[];
}

const SEED_CASES: SeedCase[] = [
  {
    customer: "Harbor Fitness",
    salesperson: "Ava Chen",
    stage: "DEMO",
    categoryCode: "PRICE_OBJECTION",
    subtype: "ROI_UNCLEAR",
    severity: "HIGH",
    description:
      "The operations lead understands the manual follow-up problem but cannot see the financial return.",
    evidence:
      "I see the time savings, but I cannot show my CFO the return on this.",
    confidence: 0.92,
    daysAgo: 42,
    executions: [
      {
        strategyName: "Discovery-first value clarification",
        strategyType: "DISCOVERY_FIRST",
        approach:
          "Asked how many staff hours per week are spent on manual renewal follow-ups.",
      },
      {
        strategyName: "ROI justification",
        strategyType: "ROI_JUSTIFICATION",
        approach:
          "Quantified 18 weekly staff hours and compared them with the annual subscription cost.",
        outcomeType: "DEMO_ACCEPTED",
        outcomeEvidence:
          "That comparison is helpful. Let's schedule the demo for next week.",
      },
    ],
  },
  {
    customer: "Peak Performance Lab",
    salesperson: "Ben Ortiz",
    stage: "PROPOSAL",
    categoryCode: "PRICE_OBJECTION",
    subtype: "ROI_UNCLEAR",
    severity: "MEDIUM",
    description:
      "The buyer wants a measurable operational case before reviewing the proposal.",
    evidence:
      "If you can show the operational savings, I can take this to finance.",
    confidence: 0.88,
    daysAgo: 35,
    executions: [
      {
        strategyName: "ROI justification",
        strategyType: "ROI_JUSTIFICATION",
        approach:
          "Mapped manual scheduling and renewal costs to a monthly savings estimate.",
        outcomeType: "OBJECTION_RESOLVED",
        outcomeEvidence:
          "That resolves my concern. Send the proposal and I will review it with finance.",
      },
    ],
  },
  {
    customer: "Cedar Park Gym",
    salesperson: "Chloe Patel",
    stage: "DISCOVERY",
    categoryCode: "PRICE_OBJECTION",
    subtype: "ROI_UNCLEAR",
    severity: "HIGH",
    description:
      "A small studio does not have the finance capacity to model ROI and deprioritized the purchase.",
    evidence:
      "We do not have anyone who can build that model, and it is not a priority right now.",
    confidence: 0.8,
    daysAgo: 28,
    executions: [
      {
        strategyName: "ROI justification",
        strategyType: "ROI_JUSTIFICATION",
        approach:
          "Walked through a detailed ROI spreadsheet and payback calculation.",
        outcomeType: "DEAL_LOST",
        outcomeEvidence:
          "We are going to stay with our current process for now.",
      },
    ],
  },
  {
    customer: "Riverstone Athletics",
    salesperson: "Ava Chen",
    stage: "QUALIFICATION",
    categoryCode: "PRICE_OBJECTION",
    subtype: "BUDGET_UNAVAILABLE",
    severity: "MEDIUM",
    description:
      "The buyer supports the product but the annual budget is already allocated.",
    evidence:
      "The budget for this year is locked. I could revisit next budget cycle.",
    confidence: 0.86,
    daysAgo: 25,
    executions: [
      {
        strategyName: "Phased implementation",
        strategyType: "PHASED_IMPLEMENTATION",
        approach:
          "Proposed a smaller first phase focused on renewal reminders only.",
        outcomeType: "MEETING_BOOKED",
        outcomeEvidence:
          "A smaller first phase could work. Let's meet next Tuesday.",
      },
    ],
  },
  {
    customer: "Summit Movement",
    salesperson: "Ben Ortiz",
    stage: "DISCOVERY",
    categoryCode: "PRICE_OBJECTION",
    subtype: "BUDGET_UNAVAILABLE",
    severity: "MEDIUM",
    description:
      "The customer wants the full platform but cannot fund the complete rollout now.",
    evidence:
      "We cannot commit to the full rollout until the next quarter.",
    confidence: 0.83,
    daysAgo: 21,
    executions: [
      {
        strategyName: "Phased implementation",
        strategyType: "PHASED_IMPLEMENTATION",
        approach:
          "Scoped a pilot for one location with an expansion option.",
        outcomeType: "DEMO_ACCEPTED",
        outcomeEvidence:
          "The pilot scope makes sense. Show us the pilot workflow.",
      },
    ],
  },
  {
    customer: "Ironwood Strength",
    salesperson: "Chloe Patel",
    stage: "DISCOVERY",
    categoryCode: "PRICE_OBJECTION",
    subtype: "TOO_EXPENSIVE",
    severity: "HIGH",
    description:
      "The buyer compares the subscription with a cheaper point solution.",
    evidence:
      "It is more expensive than the basic tool we looked at.",
    confidence: 0.9,
    daysAgo: 19,
    executions: [
      {
        strategyName: "Value differentiation",
        strategyType: "VALUE_DIFFERENTIATION",
        approach:
          "Compared operational outcomes, retention impact and integration scope instead of list price.",
        outcomeType: "POSITIVE_RESPONSE",
        outcomeEvidence:
          "I had not considered the retention impact. Send me the comparison.",
      },
    ],
  },
  {
    customer: "Bluebird Wellness",
    salesperson: "Ava Chen",
    stage: "PROPOSAL",
    categoryCode: "TRUST_AND_RISK",
    subtype: "MIGRATION",
    severity: "HIGH",
    description:
      "The operations team fears disruption while migrating member and payment data.",
    evidence:
      "A failed migration would shut down our front desk for a week.",
    confidence: 0.94,
    daysAgo: 17,
    executions: [
      {
        strategyName: "Security and migration proof",
        strategyType: "SECURITY_PROOF",
        approach:
          "Reviewed the migration checklist, rollback plan and security controls.",
        outcomeType: "OBJECTION_RESOLVED",
        outcomeEvidence:
          "The rollback plan addresses my main concern. Let's continue.",
      },
    ],
  },
  {
    customer: "North Loop Fitness",
    salesperson: "Ben Ortiz",
    stage: "DEMO",
    categoryCode: "TRUST_AND_RISK",
    subtype: "MIGRATION",
    severity: "MEDIUM",
    description:
      "The buyer wants a lower-risk path to migration before committing.",
    evidence:
      "We need to move in stages rather than all at once.",
    confidence: 0.87,
    daysAgo: 14,
    executions: [
      {
        strategyName: "Phased implementation",
        strategyType: "PHASED_IMPLEMENTATION",
        approach:
          "Proposed migrating members first and payments after a validation window.",
        outcomeType: "DEMO_ACCEPTED",
        outcomeEvidence:
          "That staged approach is acceptable. Show us the migration dashboard.",
      },
    ],
  },
  {
    customer: "Lakeside Club",
    salesperson: "Chloe Patel",
    stage: "DISCOVERY",
    categoryCode: "TRUST_AND_RISK",
    subtype: "MIGRATION",
    severity: "HIGH",
    description:
      "A highly risk-averse buyer is not ready to change systems despite a phased plan.",
    evidence:
      "Even a staged migration feels too risky for us this year.",
    confidence: 0.82,
    daysAgo: 12,
    executions: [
      {
        strategyName: "Phased implementation",
        strategyType: "PHASED_IMPLEMENTATION",
        approach:
          "Offered a phased migration and a parallel-run period.",
        outcomeType: "NO_CHANGE",
        outcomeEvidence:
          "We still need to wait until next year before changing systems.",
      },
    ],
  },
  {
    customer: "Orchid Studio",
    salesperson: "Ava Chen",
    stage: "DISCOVERY",
    categoryCode: "LACK_OF_URGENCY",
    subtype: "NO_DEADLINE",
    severity: "MEDIUM",
    description:
      "The buyer likes the product but has no compelling event to act now.",
    evidence:
      "We are interested, but there is no deadline forcing us to move.",
    confidence: 0.78,
    daysAgo: 10,
    executions: [
      {
        strategyName: "Urgency creation",
        strategyType: "URGENCY_CREATION",
        approach:
          "Highlighted the upcoming peak season and the cost of another manual renewal cycle.",
        outcomeType: "NO_CHANGE",
        outcomeEvidence:
          "We can handle another season with the current process.",
      },
    ],
  },
  {
    customer: "Tidewater Fitness",
    salesperson: "Ben Ortiz",
    stage: "QUALIFICATION",
    categoryCode: "LACK_OF_URGENCY",
    subtype: "WAITING_FOR_BUDGET",
    severity: "MEDIUM",
    description:
      "The buyer is waiting for a budget window and needs a lower-commitment first step.",
    evidence:
      "We cannot start before the next budget window, but a pilot could fit.",
    confidence: 0.84,
    daysAgo: 8,
    executions: [
      {
        strategyName: "Phased implementation",
        strategyType: "PHASED_IMPLEMENTATION",
        approach:
          "Proposed a single-location pilot timed to the next budget window.",
        outcomeType: "MEETING_BOOKED",
        outcomeEvidence:
          "Let's plan the pilot with finance next week.",
      },
    ],
  },
  {
    customer: "Beacon Sports Club",
    salesperson: "Chloe Patel",
    stage: "DEMO",
    categoryCode: "COMPETITOR_COMPARISON",
    subtype: "FEATURE_COMPARISON",
    severity: "MEDIUM",
    description:
      "The customer compares feature checklists with a lower-cost competitor.",
    evidence:
      "The other system has a longer feature list for the same price.",
    confidence: 0.85,
    daysAgo: 5,
    executions: [
      {
        strategyName: "Competitive proof",
        strategyType: "COMPETITIVE_PROOF",
        approach:
          "Compared outcome-level capabilities, integration depth and support model with a side-by-side proof.",
        outcomeType: "PROPOSAL_REQUESTED",
        outcomeEvidence:
          "That comparison is credible. Please send a proposal for the pilot.",
      },
    ],
  },
  {
    customer: "Atlas Performance",
    salesperson: "Ava Chen",
    stage: "QUALIFICATION",
    categoryCode: "STAKEHOLDER_CHALLENGE",
    subtype: "DECISION_MAKER_UNAVAILABLE",
    severity: "HIGH",
    description:
      "The champion cannot get the decision-maker into the evaluation.",
    evidence:
      "My director is not available, so I cannot move this forward alone.",
    confidence: 0.81,
    daysAgo: 3,
    executions: [
      {
        strategyName: "Stakeholder alignment",
        strategyType: "STAKEHOLDER_ALIGNMENT",
        approach:
          "Built a one-page decision brief for the champion to share with the director.",
        outcomeType: "DEAL_ADVANCED",
        outcomeEvidence:
          "The director will join the next call with the brief.",
      },
    ],
  },
  {
    customer: "Meridian Health Club",
    salesperson: "Ben Ortiz",
    stage: "NEGOTIATION",
    categoryCode: "NEGOTIATION",
    subtype: "DISCOUNT_REQUEST",
    severity: "MEDIUM",
    description:
      "The buyer asks for a discount at the end of the procurement process.",
    evidence:
      "We need a 20 percent discount or we cannot sign this quarter.",
    confidence: 0.89,
    daysAgo: 1,
    executions: [
      {
        strategyName: "Negotiation trade-off",
        strategyType: "NEGOTIATION_TRADEOFF",
        approach:
          "Traded a smaller discount for a longer commitment and a faster start date.",
        outcomeType: "DEAL_WON",
        outcomeEvidence:
          "That structure works for us. We can sign this quarter.",
      },
    ],
  },
];

const SEED_TECHNIQUES = [
  {
    name: "ROI-first discovery",
    description:
      "Ask for the cost of the current manual process before defending price. Use the customer's own numbers to build the financial case.",
    source: "Synthetic seed · internal training notes",
  },
  {
    name: "Migration proof sequence",
    description:
      "Show the migration checklist, rollback path and a parallel-run option before discussing implementation speed.",
    source: "Synthetic seed · internal playbook",
  },
  {
    name: "Phased pilot framing",
    description:
      "When budget is constrained, scope a single-location pilot with a clear expansion path instead of discounting the full rollout.",
    source: "Synthetic seed · internal playbook",
  },
];

const SEED_STRATEGY_NAMES = Array.from(
  new Set(
    SEED_CASES.flatMap((item) =>
      item.executions.map((execution) => execution.strategyName),
    ),
  ),
);

async function findOrCreateSalesperson(
  organizationId: string,
  name: string,
) {
  const existing = await prisma.salesperson.findFirst({
    where: { organizationId, name },
  });
  if (existing) return existing;
  return prisma.salesperson.create({
    data: {
      organizationId,
      name,
      role: "SALES_REP",
    },
  });
}

async function findOrCreateStrategy(
  organizationId: string,
  createdById: string,
  name: string,
  strategyType: string,
) {
  const existing = await prisma.strategy.findFirst({
    where: { organizationId, name },
  });
  if (existing) return existing;
  return prisma.strategy.create({
    data: {
      organizationId,
      name,
      description: `${name} observed in synthetic organizational cases.`,
      strategyType,
      scope: "ORGANIZATIONAL",
      createdById,
    },
  });
}

async function clearSyntheticData(organizationId: string) {
  const [cases, playbooks, techniques] = await Promise.all([
    prisma.caseInstance.findMany({
      where: { organizationId, isSynthetic: true },
      select: { id: true },
    }),
    prisma.organizationalPlaybook.findMany({
      where: { organizationId, isSynthetic: true },
      select: { id: true, versions: { select: { id: true } } },
    }),
    prisma.personalTechnique.findMany({
      where: { organizationId, source: { contains: "Synthetic seed" } },
      select: { id: true },
    }),
  ]);

  const caseIds = cases.map((item) => item.id);
  const versionIds = playbooks.flatMap((item) =>
    item.versions.map((version) => version.id),
  );
  const techniqueIds = techniques.map((item) => item.id);

  const entityIds = [...caseIds, ...versionIds, ...techniqueIds];
  if (entityIds.length > 0) {
    await prisma.organizationMemorySync.deleteMany({
      where: { organizationId, entityId: { in: entityIds } },
    });
  }

  if (playbooks.length > 0) {
    await prisma.organizationalPlaybook.deleteMany({
      where: { id: { in: playbooks.map((item) => item.id) } },
    });
  }
  if (caseIds.length > 0) {
    await prisma.caseInstance.deleteMany({ where: { id: { in: caseIds } } });
  }
  if (techniqueIds.length > 0) {
    await prisma.personalTechnique.deleteMany({
      where: { id: { in: techniqueIds } },
    });
  }

  await prisma.deal.deleteMany({
    where: {
      isSynthetic: true,
      description: { contains: "Synthetic hackathon dataset" },
    },
  });

  await prisma.strategy.deleteMany({
    where: {
      organizationId,
      name: { in: SEED_STRATEGY_NAMES },
      executions: { none: {} },
    },
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await handler(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function seedOrganizationDemo() {
  const organization = await getDefaultOrganizationContext();
  const taxonomy = await ensureCaseTaxonomy();
  await clearSyntheticData(organization.organizationId);

  const salespeople = new Map<string, string>();
  for (const name of new Set(SEED_CASES.map((item) => item.salesperson))) {
    const person = await findOrCreateSalesperson(
      organization.organizationId,
      name,
    );
    salespeople.set(name, person.id);
  }

  const createdCaseIds: string[] = [];
  const createdDealIds: string[] = [];

  for (const seed of SEED_CASES) {
    const categoryId = taxonomy.get(seed.categoryCode);
    if (!categoryId) continue;
    const callDate = new Date(
      Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000,
    );
    const salespersonId = salespeople.get(seed.salesperson);
    if (!salespersonId) continue;

    const deal = await prisma.deal.create({
      data: {
        customerName: `Synthetic · ${seed.customer}`,
        productName: "Gym Management Software",
        description:
          "Synthetic hackathon dataset. This is not a real customer conversation or actual performance record.",
        stage: seed.stage,
        status: "ACTIVE",
        isSynthetic: true,
        createdAt: callDate,
      },
    });
    createdDealIds.push(deal.id);

    const call = await prisma.call.create({
      data: {
        dealId: deal.id,
        title: "Synthetic discovery call",
        callDate,
        transcript:
          "[Synthetic hackathon seed record. No real customer conversation or transcript content.]",
        summary: `${seed.description} Salesperson response: ${seed.executions
          .map((execution) => execution.approach)
          .join(" ")}`,
        callNumber: 1,
        analysisStatus: "COMPLETED",
        createdAt: callDate,
      },
    });

    const caseInstance = await prisma.caseInstance.create({
      data: {
        organizationId: organization.organizationId,
        dealId: deal.id,
        callId: call.id,
        salespersonId,
        categoryId,
        subtype: seed.subtype,
        description: seed.description,
        evidence: seed.evidence,
        confidence: seed.confidence,
        dealStage: seed.stage,
        severity: seed.severity,
        isSynthetic: true,
        createdAt: callDate,
      },
    });
    createdCaseIds.push(caseInstance.id);

    for (const execution of seed.executions) {
      const strategy = await findOrCreateStrategy(
        organization.organizationId,
        salespersonId,
        execution.strategyName,
        execution.strategyType,
      );

      const strategyExecution = await prisma.strategyExecution.create({
        data: {
          caseInstanceId: caseInstance.id,
          strategyId: strategy.id,
          salespersonId,
          executionStatus: execution.outcomeType
            ? "OUTCOME_RECORDED"
            : "EXECUTED",
          decisionSource: "SALESPERSON_INDEPENDENT",
          actualApproach: execution.approach,
          executedAt: callDate,
          isSynthetic: true,
          createdAt: callDate,
        },
      });

      if (execution.outcomeType) {
        await prisma.strategyOutcome.create({
          data: {
            strategyExecutionId: strategyExecution.id,
            outcomeType: execution.outcomeType as OutcomeType,
            evidence: execution.outcomeEvidence ?? null,
            sourceCallId: call.id,
            observedAt: new Date(callDate.getTime() + 3 * 24 * 60 * 60 * 1000),
            isInferred: false,
            isSynthetic: true,
          },
        });
      }
    }
  }

  const caseSyncResults = await mapWithConcurrency(
    createdCaseIds,
    4,
    async (caseId) => (await syncCaseInstanceMemory(caseId))?.status ?? "FAILED",
  );

  const techniqueIds = await mapWithConcurrency(
    SEED_TECHNIQUES,
    3,
    async (technique) => {
      const created = await prisma.personalTechnique.create({
        data: {
          organizationId: organization.organizationId,
          name: technique.name,
          description: technique.description,
          source: technique.source,
        },
      });
      await syncPersonalTechniqueMemory(created.id);
      return created.id;
    },
  );

  const playbooks = [];
  for (const target of [
    { categoryCode: "PRICE_OBJECTION", subtype: "ROI_UNCLEAR" },
    { categoryCode: "TRUST_AND_RISK", subtype: "MIGRATION" },
    { categoryCode: "LACK_OF_URGENCY", subtype: "WAITING_FOR_BUDGET" },
  ]) {
    const draft = await createPlaybookDraft({
      organizationId: organization.organizationId,
      organizationName: organization.organizationName,
      categoryCode: target.categoryCode,
      subtype: target.subtype,
      isSynthetic: true,
    });
    if (draft) playbooks.push(draft);
  }

  return {
    organization: {
      id: organization.organizationId,
      name: organization.organizationName,
    },
    created: {
      cases: createdCaseIds.length,
      deals: createdDealIds.length,
      techniques: techniqueIds.length,
      playbooks: playbooks.length,
    },
    walrus: {
      caseSyncs: {
        completed: caseSyncResults.filter((status) => status === "COMPLETED")
          .length,
        failed: caseSyncResults.filter((status) => status === "FAILED").length,
      },
    },
    playbooks,
    notice:
      "Synthetic hackathon dataset only. It must not be represented as actual customer performance.",
  };
}
