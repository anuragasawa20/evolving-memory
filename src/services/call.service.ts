import { prisma } from "@/lib/prisma";
import { analyzeTranscript } from "@/services/llm.service";
import { syncCallMemories } from "@/services/memory.service";
import {
  analysisToFactInputs,
  normalizeSuggestedStage,
} from "@/lib/call-analysis";
import { toSafeError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import {
  cleanupCallExplorerArtifacts,
  persistReconciledMemories,
} from "@/services/memory-learning.service";
import { reconcileCallMemories } from "@/services/reconciliation.service";
import { generateRecommendationForCall } from "@/services/recommendation.service";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import {
  identifyCasesAndStrategies,
  recordOutcomesForCall,
} from "@/services/case-learning.service";
import {
  serializeFact,
  serializeMemorySync,
  toDealStage,
  toDealStatus,
} from "@/lib/serializers";
import type { CreateCallInput } from "@/lib/validation";
import type { CallDetail } from "@/types/deal";

export interface CreatedCall {
  id: string;
  dealId: string;
  callNumber: number;
  analysisStatus: string;
}

export async function createCall(
  dealId: string,
  input: CreateCallInput,
): Promise<CreatedCall | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true },
  });
  if (!deal) return null;

  const latest = await prisma.call.aggregate({
    where: { dealId },
    _max: { callNumber: true },
  });

  const call = await prisma.$transaction(async (tx) => {
    const created = await tx.call.create({
      data: {
        dealId,
        transcript: input.transcript,
        title: input.title ?? null,
        callDate: input.callDate ?? null,
        callNumber: (latest._max.callNumber ?? 0) + 1,
      },
    });
    await tx.deal.update({
      where: { id: dealId },
      data: { updatedAt: new Date() },
    });
    return created;
  });

  logIntegration({
    service: "database",
    operation: "create_call",
    ok: true,
    message: "Call transcript stored",
    meta: { dealId, callId: call.id, callNumber: call.callNumber },
  });

  return {
    id: call.id,
    dealId: call.dealId,
    callNumber: call.callNumber,
    analysisStatus: call.analysisStatus,
  };
}

export async function getCallById(callId: string): Promise<CallDetail | null> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      deal: {
        select: {
          id: true,
          customerName: true,
          productName: true,
          stage: true,
          status: true,
        },
      },
      facts: { orderBy: { createdAt: "asc" } },
      memorySync: true,
    },
  });

  if (!call) return null;

  return {
    id: call.id,
    dealId: call.dealId,
    callNumber: call.callNumber,
    title: call.title,
    callDate: call.callDate?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
    summary: call.summary,
    analysisStatus: call.analysisStatus,
    analysisError: call.analysisError,
    suggestedStage: call.suggestedStage
      ? toDealStage(call.suggestedStage)
      : null,
    stageReasoning: call.stageReasoning,
    deal: {
      id: call.deal.id,
      customerName: call.deal.customerName,
      productName: call.deal.productName,
      stage: toDealStage(call.deal.stage),
      status: toDealStatus(call.deal.status),
    },
    facts: call.facts.map((fact) =>
      serializeFact({ ...fact, callNumber: call.callNumber }),
    ),
    memorySync: serializeMemorySync(call.memorySync),
  };
}

export async function listDealCalls(dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true },
  });
  if (!deal) return null;

  const calls = await prisma.call.findMany({
    where: { dealId },
    orderBy: { callNumber: "asc" },
    select: {
      id: true,
      callNumber: true,
      title: true,
      callDate: true,
      createdAt: true,
      analysisStatus: true,
      analysisError: true,
      summary: true,
      memorySync: true,
    },
  });

  return calls.map((call) => ({
    ...call,
    callDate: call.callDate?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
    memorySync: serializeMemorySync(call.memorySync),
  }));
}

/**
 * Runs the analysis workflow after a call is created.
 *
 * PostgreSQL success and Walrus success are tracked independently: the Call
 * analysis status only reflects the LLM + database transaction, while
 * MemorySync records the separate Walrus write.
 */
export async function processCallAnalysis(callId: string): Promise<void> {
  const claim = await prisma.call.updateMany({
    where: {
      id: callId,
      analysisStatus: { in: ["PENDING", "FAILED"] },
    },
    data: {
      analysisStatus: "PROCESSING",
      analysisError: null,
    },
  });

  if (claim.count === 0) {
    return;
  }

  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      deal: {
        select: {
          id: true,
          customerName: true,
          productName: true,
          stage: true,
        },
      },
    },
  });

  if (!call) return;

  const startedAt = Date.now();

  let analysis;
  try {
    analysis = await analyzeTranscript(call.transcript);
  } catch (error) {
    const safe = toSafeError(error);
    await prisma.call.updateMany({
      where: { id: callId, analysisStatus: "PROCESSING" },
      data: { analysisStatus: "FAILED", analysisError: safe.message },
    });
    logIntegration({
      service: "llm",
      operation: "process_call_analysis",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { dealId: call.dealId, callId },
    });
    return;
  }

  const facts = analysisToFactInputs(analysis);
  const suggestedStage = normalizeSuggestedStage(analysis.suggestedStage);

  const candidates = facts.map((fact) => ({
    category: fact.category,
    content: fact.content,
    evidence: fact.evidence ?? null,
    isInferred: fact.isInferred,
    confidence: fact.confidence ?? null,
    metadata: fact.metadata ?? null,
  }));

  const decisions = await reconcileCallMemories({
    dealId: call.dealId,
    callId,
    callNumber: call.callNumber,
    summary: analysis.summary,
    candidates,
  });

  const baseTime = new Date();
  let persisted;

  try {
    persisted = await prisma.$transaction(async (tx) => {
      await cleanupCallExplorerArtifacts(tx, callId);

      await tx.call.update({
        where: { id: callId },
        data: {
          summary: analysis.summary,
          suggestedStage,
          stageReasoning: analysis.stageReasoning,
          analysisStatus: "COMPLETED",
          analysisError: null,
        },
      });

      const applied = await persistReconciledMemories(tx, {
        dealId: call.dealId,
        callId,
        callNumber: call.callNumber,
        candidates,
        decisions,
        startAt: baseTime,
      });

      await tx.memorySync.upsert({
        where: { callId },
        create: {
          callId,
          dealId: call.dealId,
          namespace: process.env.MEMWAL_NAMESPACE ?? "dealos_demo_deals",
          status: "PENDING",
        },
        update: {
          status: "PENDING",
          errorMessage: null,
          syncedAt: null,
        },
      });

      await tx.timelineEvent.create({
        data: {
          dealId: call.dealId,
          eventType: "CALL_ANALYZED",
          title: `Call ${call.callNumber} analyzed`,
          description: analysis.summary,
          sourceCallId: callId,
          metadata: {
            callNumber: call.callNumber,
            created: applied.created,
            confirmed: applied.confirmed,
            refined: applied.refined,
            contradicted: applied.contradicted,
            memoryIds: applied.memoryIds,
            factCount: facts.length,
          },
          createdAt: baseTime,
        },
      });

      return applied;
    });
  } catch (error) {
    const safe = toSafeError(error);
    await prisma.call.updateMany({
      where: { id: callId, analysisStatus: "PROCESSING" },
      data: { analysisStatus: "FAILED", analysisError: safe.message },
    });
    logIntegration({
      service: "database",
      operation: "persist_call_analysis",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { dealId: call.dealId, callId },
    });
    return;
  }

  logIntegration({
    service: "database",
    operation: "persist_call_analysis",
    ok: true,
    message: "Call analysis, memory reconciliation and provenance committed",
    durationMs: Date.now() - startedAt,
    meta: {
      dealId: call.dealId,
      callId,
      factCount: facts.length,
      created: persisted.created,
      confirmed: persisted.confirmed,
      refined: persisted.refined,
      contradicted: persisted.contradicted,
    },
  });

  try {
    const organization = await getDefaultOrganizationContext();
    const memories = await prisma.extractedFact.findMany({
      where: { dealId: call.dealId },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        category: true,
        content: true,
        evidence: true,
      },
    });

    await identifyCasesAndStrategies({
      organizationId: organization.organizationId,
      salespersonId: organization.salespersonId,
      dealId: call.dealId,
      callId,
      callNumber: call.callNumber,
      callDate: call.callDate,
      customerName: call.deal.customerName,
      productName: call.deal.productName,
      stage: call.deal.stage,
      summary: analysis.summary,
      transcript: call.transcript,
      memories,
    });

    await recordOutcomesForCall({
      dealId: call.dealId,
      callId,
      callNumber: call.callNumber,
      callDate: call.callDate,
      summary: analysis.summary,
      transcript: call.transcript,
    });
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "database",
      operation: "organizational_learning",
      ok: false,
      message: safe.message,
      code: safe.code,
      meta: { dealId: call.dealId, callId },
    });
  }

  await generateRecommendationForCall({
    dealId: call.dealId,
    callId,
    callNumber: call.callNumber,
    summary: analysis.summary,
  });

  await syncCallMemories(callId);
}
