import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CASE_TAXONOMY,
  NEGATIVE_OUTCOMES,
  OUTCOME_LABELS,
  POSITIVE_OUTCOMES,
  STRATEGY_TYPE_LABELS,
  getCategoryDefinition,
} from "@/lib/case-taxonomy";
import {
  buildPlaybookPrompt,
  parsePlaybookSynthesis,
  PLAYBOOK_SYNTHESIS_SYSTEM_PROMPT,
  type PlaybookSynthesis,
} from "@/lib/playbook-synthesis";
import { requestJsonCompletion } from "@/lib/llm-json";
import { toSafeError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import {
  getOrganizationMemoryStatus,
  syncPlaybookVersionMemory,
} from "@/services/organization-memory.service";
import { ensureCaseTaxonomy } from "@/services/organization.service";

type CaseRow = Prisma.CaseInstanceGetPayload<{
  include: {
    category: true;
    call: { select: { id: true; callNumber: true; callDate: true } };
    salesperson: { select: { id: true; name: true } };
    executions: {
      include: {
        strategy: true;
        outcomes: true;
        recommendation: { select: { id: true; status: true } };
      };
    };
  };
}>;

export interface StrategyEvidenceStats {
  strategyId: string;
  name: string;
  type: string;
  typeLabel: string;
  executions: number;
  positive: number;
  negative: number;
  neutral: number;
  pending: number;
  confidence: number;
  contexts: string[];
  caseIds: string[];
  executionIds: string[];
  outcomeBreakdown: { outcomeType: string; label: string; count: number }[];
  isSynthetic: boolean;
  lastEvaluatedAt: string | null;
}

export interface CaseLibraryCategory {
  categoryCode: string;
  categoryName: string;
  description: string;
  totalCases: number;
  syntheticCases: number;
  lastObservedAt: string | null;
  subtypes: {
    subtype: string;
    label: string;
    count: number;
    positive: number;
    negative: number;
  }[];
}

export interface StrategyExplorerData {
  categoryCode: string;
  categoryName: string;
  subtype: string | null;
  totalCases: number;
  totalExecutions: number;
  totalOutcomes: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  pendingOutcomes: number;
  strategies: StrategyEvidenceStats[];
  cases: {
    id: string;
    subtype: string;
    description: string;
    evidence: string | null;
    dealStage: string | null;
    severity: string | null;
    confidence: number | null;
    salespersonName: string | null;
    callNumber: number;
    isSynthetic: boolean;
    createdAt: string;
    strategies: string[];
    outcomes: string[];
  }[];
}

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function strategyConfidence(stats: {
  executions: number;
  positive: number;
  negative: number;
  neutral: number;
}): number {
  const outcomes = stats.positive + stats.negative + stats.neutral;
  const sample = Math.min(1, stats.executions / 5);
  const completeness = stats.executions > 0 ? outcomes / stats.executions : 0;
  const positiveRatio = outcomes > 0 ? stats.positive / outcomes : 0;
  return round2(0.25 * sample + 0.25 * completeness + 0.5 * positiveRatio);
}

function labelForSubtype(subtype: string): string {
  for (const category of CASE_TAXONOMY) {
    const match = category.subtypes.find((item) => item.code === subtype);
    if (match) return match.name;
  }
  return subtype;
}

function loadOrganizationCases(
  organizationId: string,
): Promise<CaseRow[]> {
  return prisma.caseInstance.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      call: { select: { id: true, callNumber: true, callDate: true } },
      salesperson: { select: { id: true, name: true } },
      executions: {
        include: {
          strategy: true,
          outcomes: true,
          recommendation: { select: { id: true, status: true } },
        },
      },
    },
  });
}

function aggregateStrategies(cases: CaseRow[]): StrategyEvidenceStats[] {
  const map = new Map<string, StrategyEvidenceStats>();

  for (const caseInstance of cases) {
    for (const execution of caseInstance.executions) {
      let stats = map.get(execution.strategyId);
      if (!stats) {
        stats = {
          strategyId: execution.strategyId,
          name: execution.strategy.name,
          type: execution.strategy.strategyType,
          typeLabel:
            STRATEGY_TYPE_LABELS[execution.strategy.strategyType] ??
            execution.strategy.strategyType,
          executions: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          pending: 0,
          confidence: 0,
          contexts: [],
          caseIds: [],
          executionIds: [],
          outcomeBreakdown: [],
          isSynthetic: false,
          lastEvaluatedAt: null,
        };
        map.set(execution.strategyId, stats);
      }

      stats.executions += 1;
      if (!stats.caseIds.includes(caseInstance.id)) {
        stats.caseIds.push(caseInstance.id);
      }
      stats.executionIds.push(execution.id);
      stats.isSynthetic = stats.isSynthetic || caseInstance.isSynthetic;
      if (caseInstance.dealStage) {
        const context = caseInstance.dealStage;
        if (!stats.contexts.includes(context)) stats.contexts.push(context);
      }

      if (execution.outcomes.length === 0) {
        stats.pending += 1;
      } else {
        for (const outcome of execution.outcomes) {
          if (POSITIVE_OUTCOMES.has(outcome.outcomeType)) stats.positive += 1;
          else if (NEGATIVE_OUTCOMES.has(outcome.outcomeType)) stats.negative += 1;
          else stats.neutral += 1;
          const observedAt = outcome.observedAt.toISOString();
          if (!stats.lastEvaluatedAt || observedAt > stats.lastEvaluatedAt) {
            stats.lastEvaluatedAt = observedAt;
          }
        }
      }
    }
  }

  const allOutcomeTypes = new Set<string>();
  for (const caseInstance of cases) {
    for (const execution of caseInstance.executions) {
      for (const outcome of execution.outcomes) {
        allOutcomeTypes.add(outcome.outcomeType);
      }
    }
  }

  for (const stats of map.values()) {
    stats.confidence = strategyConfidence(stats);
    stats.outcomeBreakdown = Array.from(allOutcomeTypes)
      .map((outcomeType) => ({
        outcomeType,
        label: OUTCOME_LABELS[outcomeType] ?? outcomeType,
        count: cases.reduce(
          (sum, caseInstance) =>
            sum +
            caseInstance.executions
              .filter((execution) => execution.strategyId === stats.strategyId)
              .flatMap((execution) => execution.outcomes)
              .filter((outcome) => outcome.outcomeType === outcomeType).length,
          0,
        ),
      }))
      .filter((item) => item.count > 0);
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.executions - a.executions ||
      b.positive - a.positive,
  );
}

export function buildCaseLibrary(cases: CaseRow[]): CaseLibraryCategory[] {
  const byCategory = new Map<string, CaseLibraryCategory>();

  for (const caseInstance of cases) {
    const code = caseInstance.category.code;
    let category = byCategory.get(code);
    if (!category) {
      category = {
        categoryCode: code,
        categoryName: caseInstance.category.name,
        description: caseInstance.category.description,
        totalCases: 0,
        syntheticCases: 0,
        lastObservedAt: null,
        subtypes: [],
      };
      byCategory.set(code, category);
    }

    category.totalCases += 1;
    if (caseInstance.isSynthetic) category.syntheticCases += 1;
    const observedAt = caseInstance.createdAt.toISOString();
    if (!category.lastObservedAt || observedAt > category.lastObservedAt) {
      category.lastObservedAt = observedAt;
    }

    let subtype = category.subtypes.find(
      (item) => item.subtype === caseInstance.subtype,
    );
    if (!subtype) {
      subtype = {
        subtype: caseInstance.subtype,
        label: labelForSubtype(caseInstance.subtype),
        count: 0,
        positive: 0,
        negative: 0,
      };
      category.subtypes.push(subtype);
    }
    subtype.count += 1;
    for (const execution of caseInstance.executions) {
      for (const outcome of execution.outcomes) {
        if (POSITIVE_OUTCOMES.has(outcome.outcomeType)) subtype.positive += 1;
        else if (NEGATIVE_OUTCOMES.has(outcome.outcomeType)) {
          subtype.negative += 1;
        }
      }
    }
  }

  return Array.from(byCategory.values())
    .map((category) => ({
      ...category,
      subtypes: category.subtypes.sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => b.totalCases - a.totalCases);
}

export function buildLearningInsights(cases: CaseRow[]) {
  const strategies = aggregateStrategies(cases);
  const library = buildCaseLibrary(cases);
  const insights: {
    id: string;
    title: string;
    description: string;
    evidenceCaseIds: string[];
    evidenceExecutionIds: string[];
    evidenceCount: number;
    confidence: number;
    isSynthetic: boolean;
  }[] = [];

  for (const strategy of strategies) {
    const subtypes = new Map<string, number>();
    const categoryCases = cases.filter((caseInstance) =>
      strategy.caseIds.includes(caseInstance.id),
    );
    for (const caseInstance of categoryCases) {
      subtypes.set(
        caseInstance.subtype,
        (subtypes.get(caseInstance.subtype) ?? 0) + 1,
      );
    }
    const topSubtype = Array.from(subtypes.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    insights.push({
      id: `strategy:${strategy.strategyId}`,
      title: `${strategy.name} is being used with measurable context`,
      description: `${strategy.executions} execution${
        strategy.executions === 1 ? "" : "s"
      } across ${strategy.caseIds.length} case${
        strategy.caseIds.length === 1 ? "" : "s"
      }. ${strategy.positive} positive, ${strategy.negative} negative and ${
        strategy.pending
      } pending outcome${strategy.pending === 1 ? "" : "s"}. Most common subtype: ${
        topSubtype ? labelForSubtype(topSubtype[0]) : "not recorded"
      }.`,
      evidenceCaseIds: strategy.caseIds,
      evidenceExecutionIds: strategy.executionIds,
      evidenceCount: strategy.executionIds.length,
      confidence: strategy.confidence,
      isSynthetic: strategy.isSynthetic,
    });

    if (strategy.contexts.length > 0 && strategy.positive > 0) {
      insights.push({
        id: `context:${strategy.strategyId}`,
        title: `${strategy.name} has positive evidence in specific stages`,
        description: `Observed in ${strategy.contexts.join(
          ", ",
        )}. This is conditional evidence from ${strategy.executions} execution${
          strategy.executions === 1 ? "" : "s"
        }, not a universal recommendation.`,
        evidenceCaseIds: strategy.caseIds,
        evidenceExecutionIds: strategy.executionIds,
        evidenceCount: strategy.executionIds.length,
        confidence: strategy.confidence,
        isSynthetic: strategy.isSynthetic,
      });
    }
  }

  for (const category of library) {
    if (category.totalCases < 2) continue;
    const topSubtype = category.subtypes[0];
    insights.push({
      id: `case:${category.categoryCode}`,
      title: `${category.categoryName} recurs across cases`,
      description: `${category.totalCases} comparable cases, led by ${
        topSubtype?.label ?? "an unclassified subtype"
      } (${topSubtype?.count ?? 0}). Use this pattern to prepare discovery questions, not to assume causality.`,
      evidenceCaseIds: cases
        .filter((caseInstance) => caseInstance.category.code === category.categoryCode)
        .map((caseInstance) => caseInstance.id),
      evidenceExecutionIds: [],
      evidenceCount: category.totalCases,
      confidence: round2(Math.min(0.9, 0.3 + category.totalCases * 0.1)),
      isSynthetic: category.syntheticCases > 0,
    });
  }

  return insights
    .sort((a, b) => b.evidenceCount - a.evidenceCount || b.confidence - a.confidence)
    .slice(0, 12);
}

async function loadPlaybooks(organizationId: string) {
  const playbooks = await prisma.organizationalPlaybook.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    include: {
      caseCategory: true,
      versions: {
        orderBy: { version: "desc" },
        include: {
          recommendedStrategy: {
            select: { id: true, name: true, strategyType: true },
          },
          approvedBy: { select: { id: true, name: true } },
          _count: { select: { evidence: true } },
        },
      },
    },
  });

  return playbooks.map((playbook) => ({
    id: playbook.id,
    title: playbook.title,
    description: playbook.description,
    status: playbook.status,
    currentVersion: playbook.currentVersion,
    isSynthetic: playbook.isSynthetic,
    categoryCode: playbook.caseCategory.code,
    categoryName: playbook.caseCategory.name,
    subtype: playbook.subtype,
    updatedAt: playbook.updatedAt.toISOString(),
    versions: playbook.versions.map((version) => ({
      id: version.id,
      version: version.version,
      guidance: version.guidance,
      conditions: version.conditions,
      exceptions: version.exceptions,
      evidenceSummary: version.evidenceSummary,
      confidence: toNumber(version.confidence),
      approvalStatus: version.approvalStatus,
      createdAt: version.createdAt.toISOString(),
      approvedAt: version.approvedAt?.toISOString() ?? null,
      approvedBy: version.approvedBy,
      recommendedStrategy: version.recommendedStrategy
        ? {
            id: version.recommendedStrategy.id,
            name: version.recommendedStrategy.name,
            typeLabel:
              STRATEGY_TYPE_LABELS[version.recommendedStrategy.strategyType] ??
              version.recommendedStrategy.strategyType,
          }
        : null,
      evidenceCount: version._count.evidence,
    })),
  }));
}

export async function getOrganizationIntelligence(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { salespeople: { orderBy: { name: "asc" } } },
  });
  if (!organization) return null;

  const cases = await loadOrganizationCases(organizationId);
  const strategies = aggregateStrategies(cases);
  const [playbooks, walrus] = await Promise.all([
    loadPlaybooks(organizationId),
    getOrganizationMemoryStatus(organizationId),
  ]);

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      salespeople: organization.salespeople.map((salesperson) => ({
        id: salesperson.id,
        name: salesperson.name,
        role: salesperson.role,
      })),
    },
    taxonomy: CASE_TAXONOMY,
    totals: {
      cases: cases.length,
      syntheticCases: cases.filter((caseInstance) => caseInstance.isSynthetic)
        .length,
      strategyExecutions: cases.reduce(
        (sum, caseInstance) => sum + caseInstance.executions.length,
        0,
      ),
      outcomes: cases.reduce(
        (sum, caseInstance) =>
          sum +
          caseInstance.executions.reduce(
            (outcomeSum, execution) => outcomeSum + execution.outcomes.length,
            0,
          ),
        0,
      ),
      strategies: strategies.length,
      playbooks: playbooks.length,
      activePlaybooks: playbooks.filter(
        (playbook) => playbook.status === "ACTIVE" || playbook.status === "APPROVED",
      ).length,
    },
    caseLibrary: buildCaseLibrary(cases),
    strategies,
    playbooks,
    insights: buildLearningInsights(cases),
    walrus,
  };
}

export async function getStrategyExplorer(
  organizationId: string,
  categoryCode: string,
  subtype?: string | null,
): Promise<StrategyExplorerData | null> {
  const definition = getCategoryDefinition(categoryCode);
  if (!definition) return null;

  const allCases = await loadOrganizationCases(organizationId);
  const filtered = allCases.filter(
    (caseInstance) =>
      caseInstance.category.code === categoryCode &&
      (!subtype || caseInstance.subtype === subtype),
  );
  const strategies = aggregateStrategies(filtered);

  return {
    categoryCode,
    categoryName: definition.name,
    subtype: subtype ?? null,
    totalCases: filtered.length,
    totalExecutions: filtered.reduce(
      (sum, caseInstance) => sum + caseInstance.executions.length,
      0,
    ),
    totalOutcomes: filtered.reduce(
      (sum, caseInstance) =>
        sum +
        caseInstance.executions.reduce(
          (outcomeSum, execution) => outcomeSum + execution.outcomes.length,
          0,
        ),
      0,
    ),
    positiveOutcomes: filtered.reduce(
      (sum, caseInstance) =>
        sum +
        caseInstance.executions.reduce(
          (outcomeSum, execution) =>
            outcomeSum +
            execution.outcomes.filter((outcome) =>
              POSITIVE_OUTCOMES.has(outcome.outcomeType),
            ).length,
          0,
        ),
      0,
    ),
    negativeOutcomes: filtered.reduce(
      (sum, caseInstance) =>
        sum +
        caseInstance.executions.reduce(
          (outcomeSum, execution) =>
            outcomeSum +
            execution.outcomes.filter((outcome) =>
              NEGATIVE_OUTCOMES.has(outcome.outcomeType),
            ).length,
          0,
        ),
      0,
    ),
    pendingOutcomes: filtered.reduce(
      (sum, caseInstance) =>
        sum +
        caseInstance.executions.filter(
          (execution) => execution.outcomes.length === 0,
        ).length,
      0,
    ),
    strategies,
    cases: filtered.map((caseInstance) => ({
      id: caseInstance.id,
      subtype: caseInstance.subtype,
      description: caseInstance.description,
      evidence: caseInstance.evidence,
      dealStage: caseInstance.dealStage,
      severity: caseInstance.severity,
      confidence: toNumber(caseInstance.confidence),
      salespersonName: caseInstance.salesperson?.name ?? null,
      callNumber: caseInstance.call.callNumber,
      isSynthetic: caseInstance.isSynthetic,
      createdAt: caseInstance.createdAt.toISOString(),
      strategies: caseInstance.executions.map(
        (execution) => execution.strategy.name,
      ),
      outcomes: caseInstance.executions.flatMap((execution) =>
        execution.outcomes.map((outcome) => outcome.outcomeType),
      ),
    })),
  };
}

function deterministicSynthesis(input: {
  categoryName: string;
  subtype: string;
  strategies: StrategyEvidenceStats[];
}): PlaybookSynthesis {
  const top = input.strategies[0];
  const contexts = top?.contexts.length ? top.contexts.join(", ") : "recorded cases";
  return {
    title: `${input.categoryName}: ${labelForSubtype(input.subtype)}`,
    description: `Evidence-backed guidance for ${input.categoryName.toLowerCase()} situations with subtype ${labelForSubtype(
      input.subtype,
    )}.`,
    guidance: top
      ? `Consider ${top.name}. It was executed ${top.executions} time${
          top.executions === 1 ? "" : "s"
        } with ${top.positive} positive and ${top.negative} negative observed outcome${
          top.positive + top.negative === 1 ? "" : "s"
        }. Treat this as conditional guidance, not a universal winner.`
      : "There is not yet enough strategy evidence to recommend an approach.",
    whenToUse: `Use when the customer context resembles the recorded cases (${contexts}).`,
    whenNotToUse:
      "Do not use when the customer context, deal stage or stakeholder situation differs materially from the evidence.",
    suggestedQuestions: [
      "What is the operational or financial problem behind this situation?",
      "Which stakeholder owns the decision and the budget?",
    ],
    exceptions: top
      ? `Pending or missing outcomes: ${top.pending}. Re-evaluate as new evidence arrives.`
      : "No exceptions recorded yet.",
    recommendedStrategyId: top?.strategyId ?? null,
    confidence: top?.confidence ?? 0,
  };
}

export async function createPlaybookDraft(input: {
  organizationId: string;
  organizationName: string;
  categoryCode: string;
  subtype: string;
  isSynthetic?: boolean;
}): Promise<{
  playbookId: string;
  versionId: string;
  version: number;
  status: string;
} | null> {
  const definition = getCategoryDefinition(input.categoryCode);
  if (!definition) return null;
  const taxonomy = await ensureCaseTaxonomy();
  const categoryId = taxonomy.get(input.categoryCode);
  if (!categoryId) return null;

  const allCases = await loadOrganizationCases(input.organizationId);
  const filtered = allCases.filter(
    (caseInstance) =>
      caseInstance.category.code === input.categoryCode &&
      caseInstance.subtype === input.subtype,
  );
  if (filtered.length === 0) return null;

  const strategies = aggregateStrategies(filtered);
  if (strategies.length === 0) return null;

  const prompt = buildPlaybookPrompt({
    organizationName: input.organizationName,
    categoryCode: input.categoryCode,
    categoryName: definition.name,
    subtype: input.subtype,
    totalCases: filtered.length,
    strategies: strategies.map((strategy) => ({
      id: strategy.strategyId,
      name: strategy.name,
      type: strategy.type,
      executions: strategy.executions,
      positive: strategy.positive,
      negative: strategy.negative,
      neutral: strategy.neutral,
      pending: strategy.pending,
      contexts: strategy.contexts,
    })),
  });

  let synthesis: PlaybookSynthesis | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await requestJsonCompletion({
        system: PLAYBOOK_SYNTHESIS_SYSTEM_PROMPT,
        user: prompt,
        maxTokens: 2_560,
      });
      synthesis = parsePlaybookSynthesis(result.content);
      break;
    } catch (error) {
      const safe = toSafeError(error);
      if (attempt === 2) {
        logIntegration({
          service: "llm",
          operation: "create_playbook_draft",
          ok: false,
          message: safe.message,
          code: safe.code,
          meta: { organizationId: input.organizationId },
        });
      }
    }
  }

  if (!synthesis) {
    synthesis = deterministicSynthesis({
      categoryName: definition.name,
      subtype: input.subtype,
      strategies,
    });
  }

  const validStrategyIds = new Set(strategies.map((item) => item.strategyId));
  const recommendedStrategyId =
    synthesis.recommendedStrategyId &&
    validStrategyIds.has(synthesis.recommendedStrategyId)
      ? synthesis.recommendedStrategyId
      : strategies[0]?.strategyId ?? null;

  const evidenceSummary = [
    `${filtered.length} comparable case${filtered.length === 1 ? "" : "s"}.`,
    ...strategies.map(
      (strategy) =>
        `${strategy.name}: ${strategy.executions} execution${
          strategy.executions === 1 ? "" : "s"
        }, ${strategy.positive} positive, ${strategy.negative} negative, ${
          strategy.pending
        } pending.`,
    ),
  ].join(" ");

  const conditions = [
    `When to use: ${synthesis.whenToUse}`,
    "",
    "Suggested questions:",
    ...synthesis.suggestedQuestions.map((question) => `- ${question}`),
  ].join("\n");

  const exceptions = [
    `When not to use: ${synthesis.whenNotToUse}`,
    "",
    `Exceptions: ${synthesis.exceptions}`,
  ].join("\n");

  const existing = await prisma.organizationalPlaybook.findFirst({
    where: {
      organizationId: input.organizationId,
      caseCategoryId: categoryId,
      subtype: input.subtype,
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, currentVersion: true },
  });

  const playbook = existing
    ? await prisma.organizationalPlaybook.update({
        where: { id: existing.id },
        data: {
          title: synthesis.title,
          description: synthesis.description,
          status: "REVIEW_REQUIRED",
          currentVersion: existing.currentVersion + 1,
          isSynthetic: input.isSynthetic ?? false,
        },
      })
    : await prisma.organizationalPlaybook.create({
        data: {
          organizationId: input.organizationId,
          caseCategoryId: categoryId,
          subtype: input.subtype,
          title: synthesis.title,
          description: synthesis.description,
          status: "REVIEW_REQUIRED",
          currentVersion: 1,
          isSynthetic: input.isSynthetic ?? false,
        },
      });

  const versionNumber = existing ? existing.currentVersion + 1 : 1;
  const version = await prisma.playbookVersion.create({
    data: {
      playbookId: playbook.id,
      version: versionNumber,
      recommendedStrategyId,
      guidance: synthesis.guidance,
      conditions,
      exceptions,
      evidenceSummary,
      confidence: synthesis.confidence ?? 0,
      approvalStatus: "PENDING",
      isSynthetic: input.isSynthetic ?? false,
    },
  });

  const evidenceStrategy = strategies.find(
    (strategy) => strategy.strategyId === recommendedStrategyId,
  );
  const evidenceCaseIds = new Set(
    evidenceStrategy?.caseIds ?? filtered.map((caseInstance) => caseInstance.id),
  );
  const evidenceExecutionIds = evidenceStrategy?.executionIds ?? [];

  await prisma.playbookEvidence.createMany({
    data: [
      ...Array.from(evidenceCaseIds).map((caseInstanceId) => ({
        playbookVersionId: version.id,
        caseInstanceId,
        evidenceType: "CASE_INSTANCE",
      })),
      ...evidenceExecutionIds.map((strategyExecutionId) => ({
        playbookVersionId: version.id,
        strategyExecutionId,
        evidenceType: "STRATEGY_EXECUTION",
      })),
    ],
  });

  return {
    playbookId: playbook.id,
    versionId: version.id,
    version: versionNumber,
    status: playbook.status,
  };
}

export async function approvePlaybookVersion(input: {
  organizationId: string;
  versionId: string;
  approverId?: string | null;
}) {
  const version = await prisma.playbookVersion.findUnique({
    where: { id: input.versionId },
    include: { playbook: true },
  });
  if (!version || version.playbook.organizationId !== input.organizationId) {
    return null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const approved = await tx.playbookVersion.update({
      where: { id: version.id },
      data: {
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        approvedById: input.approverId ?? null,
      },
    });

    await tx.organizationalPlaybook.update({
      where: { id: version.playbookId },
      data: { status: "ACTIVE", currentVersion: version.version },
    });

    return approved;
  });

  const sync = await syncPlaybookVersionMemory(updated.id);
  return { version: updated, walrus: sync };
}

export async function rejectPlaybookVersion(input: {
  organizationId: string;
  versionId: string;
}) {
  const version = await prisma.playbookVersion.findUnique({
    where: { id: input.versionId },
    include: { playbook: { include: { versions: true } } },
  });
  if (!version || version.playbook.organizationId !== input.organizationId) {
    return null;
  }

  const updated = await prisma.playbookVersion.update({
    where: { id: version.id },
    data: { approvalStatus: "REJECTED" },
  });

  const hasActive = version.playbook.versions.some(
    (item) => item.approvalStatus === "APPROVED",
  );
  await prisma.organizationalPlaybook.update({
    where: { id: version.playbookId },
    data: { status: hasActive ? "ACTIVE" : "REVISED" },
  });

  return updated;
}

export async function getPlaybookDetail(
  organizationId: string,
  playbookId: string,
) {
  const playbook = await prisma.organizationalPlaybook.findFirst({
    where: { id: playbookId, organizationId },
    include: {
      caseCategory: true,
      versions: {
        orderBy: { version: "desc" },
        include: {
          recommendedStrategy: true,
          approvedBy: { select: { id: true, name: true } },
          evidence: {
            include: {
              caseInstance: {
                include: { category: true, call: true },
              },
              strategyExecution: {
                include: { strategy: true, outcomes: true },
              },
            },
          },
        },
      },
    },
  });
  if (!playbook) return null;

  return {
    id: playbook.id,
    title: playbook.title,
    description: playbook.description,
    status: playbook.status,
    currentVersion: playbook.currentVersion,
    isSynthetic: playbook.isSynthetic,
    categoryCode: playbook.caseCategory.code,
    categoryName: playbook.caseCategory.name,
    subtype: playbook.subtype,
    updatedAt: playbook.updatedAt.toISOString(),
    versions: playbook.versions.map((version) => ({
      id: version.id,
      version: version.version,
      guidance: version.guidance,
      conditions: version.conditions,
      exceptions: version.exceptions,
      evidenceSummary: version.evidenceSummary,
      confidence: toNumber(version.confidence),
      approvalStatus: version.approvalStatus,
      approvedAt: version.approvedAt?.toISOString() ?? null,
      approvedBy: version.approvedBy,
      recommendedStrategy: version.recommendedStrategy,
      evidence: version.evidence.map((item) => ({
        id: item.id,
        evidenceType: item.evidenceType,
        caseInstance: item.caseInstance
          ? {
              id: item.caseInstance.id,
              subtype: item.caseInstance.subtype,
              description: item.caseInstance.description,
              evidence: item.caseInstance.evidence,
              dealStage: item.caseInstance.dealStage,
              isSynthetic: item.caseInstance.isSynthetic,
              callNumber: item.caseInstance.call.callNumber,
            }
          : null,
        strategyExecution: item.strategyExecution
          ? {
              id: item.strategyExecution.id,
              strategyName: item.strategyExecution.strategy.name,
              actualApproach: item.strategyExecution.actualApproach,
              executionStatus: item.strategyExecution.executionStatus,
              outcomes: item.strategyExecution.outcomes.map((outcome) => ({
                outcomeType: outcome.outcomeType,
                label: OUTCOME_LABELS[outcome.outcomeType] ?? outcome.outcomeType,
                isInferred: outcome.isInferred,
              })),
            }
          : null,
      })),
    })),
  };
}
