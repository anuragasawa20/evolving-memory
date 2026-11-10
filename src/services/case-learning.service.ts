import { prisma } from "@/lib/prisma";
import {
  buildCaseIdentificationPrompt,
  buildOutcomeObservationPrompt,
  CASE_IDENTIFICATION_SYSTEM_PROMPT,
  OUTCOME_OBSERVATION_SYSTEM_PROMPT,
  parseCaseIdentification,
  parseOutcomeObservations,
  type IdentifiedCase,
} from "@/lib/case-identification";
import { ensureCaseTaxonomy } from "@/services/organization.service";
import { syncCaseInstanceMemory } from "@/services/organization-memory.service";
import { toSafeError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import { requestJsonCompletion } from "@/lib/llm-json";
import type { FactCategory } from "@/types/deal";

export interface IdentifiedCaseResult {
  id: string;
  categoryCode: string;
  subtype: string;
  description: string;
  evidence: string | null;
  confidence: number | null;
  strategyId: string | null;
  executionId: string | null;
}

export interface IdentifyCasesInput {
  organizationId: string;
  salespersonId: string;
  dealId: string;
  callId: string;
  callNumber: number;
  callDate: Date | null;
  customerName: string;
  productName: string;
  stage: string;
  summary: string;
  transcript: string;
  memories: {
    category: FactCategory;
    content: string;
    evidence: string | null;
  }[];
}

async function requestCases(
  prompt: string,
): Promise<IdentifiedCase[]> {
  const result = await requestJsonCompletion({
    system: CASE_IDENTIFICATION_SYSTEM_PROMPT,
    user: prompt,
    maxTokens: 4_096,
  });
  return parseCaseIdentification(result.content);
}

async function cleanupCasesForCall(callId: string): Promise<void> {
  const existing = await prisma.caseInstance.findMany({
    where: { callId },
    select: { id: true },
  });
  if (existing.length === 0) return;

  const ids = existing.map((item) => item.id);
  await prisma.organizationMemorySync.deleteMany({
    where: { entityType: "CASE_INSTANCE", entityId: { in: ids } },
  });
  await prisma.caseInstance.deleteMany({ where: { id: { in: ids } } });
}

export async function identifyCasesAndStrategies(
  input: IdentifyCasesInput,
): Promise<IdentifiedCaseResult[]> {
  const startedAt = Date.now();
  const prompt = buildCaseIdentificationPrompt({
    customerName: input.customerName,
    productName: input.productName,
    stage: input.stage,
    callNumber: input.callNumber,
    summary: input.summary,
    transcript: input.transcript,
    memories: input.memories,
  });

  let identified: IdentifiedCase[] | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      identified = await requestCases(prompt);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!identified) {
    const safe = toSafeError(lastError);
    logIntegration({
      service: "llm",
      operation: "identify_cases",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { dealId: input.dealId, callId: input.callId },
    });
    return [];
  }

  await cleanupCasesForCall(input.callId);
  const taxonomy = await ensureCaseTaxonomy();

  const results = await prisma.$transaction(async (tx) => {
    const created: IdentifiedCaseResult[] = [];

    for (const item of identified) {
      const categoryId = taxonomy.get(item.categoryCode);
      if (!categoryId) continue;

      const caseInstance = await tx.caseInstance.create({
        data: {
          organizationId: input.organizationId,
          dealId: input.dealId,
          callId: input.callId,
          salespersonId: input.salespersonId,
          categoryId,
          subtype: item.subtypeCode,
          description: item.description,
          evidence: item.evidence ?? null,
          confidence: item.confidence ?? null,
          dealStage: item.dealStage ?? null,
          severity: item.severity ?? null,
          isSynthetic: false,
        },
      });

      let strategyId: string | null = null;
      let executionId: string | null = null;

      if (
        item.strategyObserved &&
        item.strategyName &&
        item.actualApproach &&
        item.strategyStatus !== "SUGGESTED"
      ) {
        let strategy = await tx.strategy.findFirst({
          where: {
            organizationId: input.organizationId,
            name: item.strategyName,
          },
          select: { id: true },
        });

        if (!strategy) {
          strategy = await tx.strategy.create({
            data: {
              organizationId: input.organizationId,
              name: item.strategyName,
              description: `${item.strategyName} observed in sales conversations.`,
              strategyType: item.strategyType ?? "OTHER",
              scope: "ORGANIZATIONAL",
              createdById: input.salespersonId,
            },
            select: { id: true },
          });
        }

        const execution = await tx.strategyExecution.create({
          data: {
            caseInstanceId: caseInstance.id,
            strategyId: strategy.id,
            salespersonId: input.salespersonId,
            executionStatus: "EXECUTED",
            decisionSource: "SALESPERSON_INDEPENDENT",
            actualApproach: item.actualApproach,
            executedAt: input.callDate ?? new Date(),
            isSynthetic: false,
          },
        });

        strategyId = strategy.id;
        executionId = execution.id;
      }

      created.push({
        id: caseInstance.id,
        categoryCode: item.categoryCode,
        subtype: item.subtypeCode,
        description: item.description,
        evidence: item.evidence ?? null,
        confidence: item.confidence ?? null,
        strategyId,
        executionId,
      });
    }

    return created;
  });

  for (const item of results) {
    // Walrus writes are tracked independently from PostgreSQL persistence.
    await syncCaseInstanceMemory(item.id);
  }

  logIntegration({
    service: "llm",
    operation: "identify_cases",
    ok: true,
    message: "Sales cases and observed strategies persisted",
    durationMs: Date.now() - startedAt,
    meta: {
      dealId: input.dealId,
      callId: input.callId,
      cases: results.length,
      executions: results.filter((item) => item.executionId).length,
    },
  });

  return results;
}

export interface OutcomeObservationResult {
  executionId: string;
  outcomeType: string;
  evidence: string | null;
  isInferred: boolean;
  caseInstanceId: string;
}

export async function recordOutcomesForCall(input: {
  dealId: string;
  callId: string;
  callNumber: number;
  callDate: Date | null;
  summary: string;
  transcript: string;
}): Promise<OutcomeObservationResult[]> {
  const executions = await prisma.strategyExecution.findMany({
    where: {
      caseInstance: {
        dealId: input.dealId,
        callId: { not: input.callId },
      },
      executionStatus: { in: ["EXECUTED", "OUTCOME_PENDING"] },
      outcomes: { none: {} },
    },
    orderBy: { executedAt: "desc" },
    take: 20,
    include: {
      strategy: true,
      caseInstance: { include: { category: true } },
    },
  });

  if (executions.length === 0) return [];

  const prompt = buildOutcomeObservationPrompt({
    callNumber: input.callNumber,
    summary: input.summary,
    transcript: input.transcript,
    executions: executions.map((execution) => ({
      id: execution.id,
      strategyName: execution.strategy.name,
      actualApproach: execution.actualApproach,
      executedAt: execution.executedAt?.toISOString() ?? null,
      caseCategory: execution.caseInstance.category.code,
      caseSubtype: execution.caseInstance.subtype,
      caseDescription: execution.caseInstance.description,
    })),
  });

  const validIds = new Set(executions.map((execution) => execution.id));
  let observations: ReturnType<typeof parseOutcomeObservations> = [];
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await requestJsonCompletion({
        system: OUTCOME_OBSERVATION_SYSTEM_PROMPT,
        user: prompt,
        maxTokens: 2_048,
      });
      observations = parseOutcomeObservations(result.content, validIds);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (observations.length === 0) {
    if (lastError) {
      const safe = toSafeError(lastError);
      logIntegration({
        service: "llm",
        operation: "record_outcomes",
        ok: false,
        message: safe.message,
        code: safe.code,
        meta: { dealId: input.dealId, callId: input.callId },
      });
    }
    return [];
  }

  const executionById = new Map(
    executions.map((execution) => [execution.id, execution]),
  );
  const affectedCases = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const observation of observations) {
      const execution = executionById.get(observation.executionId);
      if (!execution) continue;
      affectedCases.add(execution.caseInstanceId);

      await tx.strategyOutcome.create({
        data: {
          strategyExecutionId: execution.id,
          outcomeType: observation.outcomeType,
          evidence: observation.evidence ?? null,
          sourceCallId: input.callId,
          observedAt: input.callDate ?? new Date(),
          isInferred: observation.isInferred,
          isSynthetic: execution.isSynthetic,
        },
      });

      await tx.strategyExecution.update({
        where: { id: execution.id },
        data: { executionStatus: "OUTCOME_RECORDED" },
      });

      if (execution.recommendationId) {
        await tx.recommendation.update({
          where: { id: execution.recommendationId },
          data: { status: "OUTCOME_RECORDED" },
        });
      }
    }
  });

  for (const caseInstanceId of affectedCases) {
    await syncCaseInstanceMemory(caseInstanceId);
  }

  return observations.map((observation) => ({
    executionId: observation.executionId,
    outcomeType: observation.outcomeType,
    evidence: observation.evidence ?? null,
    isInferred: observation.isInferred,
    caseInstanceId:
      executionById.get(observation.executionId)?.caseInstanceId ?? "",
  }));
}
