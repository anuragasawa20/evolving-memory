import { Prisma } from "@prisma/client";
import { FACT_SINGULAR } from "@/lib/display";
import type {
  NormalizedReconciliation,
  ReconciliationCandidate,
} from "@/lib/memory-reconciliation";
import type { FactCategory } from "@/types/deal";
import type { TimelineEventType } from "@/types/memory";

export interface PersistMemoriesInput {
  dealId: string;
  callId: string;
  callNumber: number;
  candidates: ReconciliationCandidate[];
  decisions: NormalizedReconciliation[];
  startAt: Date;
}

export interface PersistMemoriesResult {
  created: number;
  confirmed: number;
  refined: number;
  contradicted: number;
  memoryIds: string[];
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function memoryLabel(category: FactCategory): string {
  return FACT_SINGULAR[category] ?? "Memory";
}

async function ensureLatestVersion(
  tx: Prisma.TransactionClient,
  memory: {
    id: string;
    callId: string;
    category: FactCategory;
    content: string;
    evidence: string | null;
    confidence: Prisma.Decimal | null;
  },
  fallbackConfidence: number | null,
) {
  const latest = await tx.memoryVersion.findFirst({
    where: { memoryId: memory.id },
    orderBy: { versionNumber: "desc" },
  });

  if (latest) return latest;

  return tx.memoryVersion.create({
    data: {
      memoryId: memory.id,
      versionNumber: 1,
      content: memory.content,
      evidence: memory.evidence,
      memoryType: memory.category,
      confidence:
        memory.confidence ?? (fallbackConfidence === null ? null : fallbackConfidence),
      sourceCallId: memory.callId,
      changeReason: "Initial memory version",
    },
  });
}

export async function cleanupCallExplorerArtifacts(
  tx: Prisma.TransactionClient,
  callId: string,
): Promise<void> {
  const recommendations = await tx.recommendation.findMany({
    where: { callId },
    select: { id: true },
  });

  if (recommendations.length > 0) {
    const recommendationIds = recommendations.map((item) => item.id);
    await tx.timelineEvent.deleteMany({
      where: { recommendationId: { in: recommendationIds } },
    });
    await tx.recommendation.deleteMany({ where: { callId } });
  }

  await tx.timelineEvent.deleteMany({ where: { sourceCallId: callId } });
  await tx.memoryLearningEvent.deleteMany({ where: { sourceCallId: callId } });
  await tx.memoryVersion.deleteMany({ where: { sourceCallId: callId } });
  await tx.memoryRelationship.deleteMany({ where: { sourceCallId: callId } });
  await tx.extractedFact.deleteMany({ where: { callId } });
}

async function createTimeline(
  tx: Prisma.TransactionClient,
  input: {
    dealId: string;
    eventType: TimelineEventType;
    title: string;
    description: string | null;
    sourceCallId: string;
    sourceMemoryId?: string | null;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  },
) {
  return tx.timelineEvent.create({
    data: {
      dealId: input.dealId,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      sourceCallId: input.sourceCallId,
      sourceMemoryId: input.sourceMemoryId ?? null,
      metadata: input.metadata ? toJsonValue(input.metadata) : undefined,
      createdAt: input.createdAt,
    },
  });
}

/**
 * Apply the reconciliation result to PostgreSQL.
 *
 * A memory is a canonical ExtractedFact. CONFIRM and REFINE append a
 * MemoryVersion and update the current snapshot, so prior evidence is never
 * destroyed. CONTRADICT preserves the conflicting statement as its own memory
 * and links it to the challenged memory with recorded provenance.
 */
export async function persistReconciledMemories(
  tx: Prisma.TransactionClient,
  input: PersistMemoriesInput,
): Promise<PersistMemoriesResult> {
  const result: PersistMemoriesResult = {
    created: 0,
    confirmed: 0,
    refined: 0,
    contradicted: 0,
    memoryIds: [],
  };

  let eventOffset = 0;
  const nextEventTime = () =>
    new Date(input.startAt.getTime() + ++eventOffset);

  const createMemory = async (
    candidate: ReconciliationCandidate,
    reason: string,
  ) => {
    const memory = await tx.extractedFact.create({
      data: {
        callId: input.callId,
        dealId: input.dealId,
        category: candidate.category,
        content: candidate.content,
        evidence: candidate.evidence,
        confidence: candidate.confidence ?? null,
        isInferred: candidate.isInferred,
        metadata: candidate.metadata
          ? toJsonValue(candidate.metadata)
          : undefined,
      },
    });

    const version = await tx.memoryVersion.create({
      data: {
        memoryId: memory.id,
        versionNumber: 1,
        content: memory.content,
        evidence: memory.evidence,
        memoryType: candidate.category,
        confidence: candidate.confidence ?? null,
        sourceCallId: input.callId,
        changeReason: reason,
      },
    });

    await tx.memoryLearningEvent.create({
      data: {
        dealId: input.dealId,
        memoryId: memory.id,
        sourceCallId: input.callId,
        action: "CREATED",
        newVersionId: version.id,
        reason,
      },
    });

    await createTimeline(tx, {
      dealId: input.dealId,
      eventType: "MEMORY_CREATED",
      title: `${memoryLabel(candidate.category)} discovered`,
      description: candidate.content,
      sourceCallId: input.callId,
      sourceMemoryId: memory.id,
      metadata: {
        category: candidate.category,
        callNumber: input.callNumber,
        isInferred: candidate.isInferred,
      },
      createdAt: nextEventTime(),
    });

    result.created += 1;
    result.memoryIds.push(memory.id);
    return memory;
  };

  for (const decision of input.decisions) {
    const candidate = input.candidates[decision.candidateIndex];
    if (!candidate) continue;

    if (decision.action === "CREATE") {
      await createMemory(candidate, decision.reason);
      continue;
    }

    const target = decision.targetMemoryId
      ? await tx.extractedFact.findFirst({
          where: { id: decision.targetMemoryId, dealId: input.dealId },
        })
      : null;

    if (!target) {
      await createMemory(
        candidate,
        `${decision.reason} (target memory was unavailable; stored as a new memory)`,
      );
      continue;
    }

    if (decision.action === "CONTRADICT") {
      const conflicting = await createMemory(
        candidate,
        decision.reason,
      );

      await tx.memoryRelationship.upsert({
        where: {
          sourceMemoryId_targetMemoryId_relationshipType: {
            sourceMemoryId: conflicting.id,
            targetMemoryId: target.id,
            relationshipType: "CONTRADICTS",
          },
        },
        create: {
          sourceMemoryId: conflicting.id,
          targetMemoryId: target.id,
          relationshipType: "CONTRADICTS",
          origin: "EXPLICIT",
          explanation: decision.reason,
          sourceCallId: input.callId,
        },
        update: {
          explanation: decision.reason,
          origin: "EXPLICIT",
        },
      });

      const latest = await ensureLatestVersion(
        tx,
        {
          id: target.id,
          callId: target.callId,
          category: target.category as FactCategory,
          content: target.content,
          evidence: target.evidence,
          confidence: target.confidence,
        },
        candidate.confidence ?? null,
      );

      await tx.memoryLearningEvent.create({
        data: {
          dealId: input.dealId,
          memoryId: target.id,
          sourceCallId: input.callId,
          action: "CONTRADICTED",
          previousVersionId: latest.id,
          reason: decision.reason,
        },
      });

      await createTimeline(tx, {
        dealId: input.dealId,
        eventType: "MEMORY_CONTRADICTED",
        title: `${memoryLabel(target.category as FactCategory)} contradicted`,
        description: candidate.content,
        sourceCallId: input.callId,
        sourceMemoryId: target.id,
        metadata: {
          category: target.category,
          callNumber: input.callNumber,
          newMemoryId: conflicting.id,
        },
        createdAt: nextEventTime(),
      });

      result.contradicted += 1;
      continue;
    }

    const latest = await ensureLatestVersion(
      tx,
      {
        id: target.id,
        callId: target.callId,
        category: target.category as FactCategory,
        content: target.content,
        evidence: target.evidence,
        confidence: target.confidence,
      },
      candidate.confidence ?? null,
    );

    const isRefine = decision.action === "REFINE";
    const nextContent = isRefine
      ? (decision.refinedContent ?? candidate.content)
      : target.content;
    const nextEvidence = isRefine
      ? (decision.refinedEvidence ?? candidate.evidence ?? target.evidence)
      : (candidate.evidence ?? target.evidence);

    const version = await tx.memoryVersion.create({
      data: {
        memoryId: target.id,
        versionNumber: latest.versionNumber + 1,
        content: nextContent,
        evidence: nextEvidence,
        memoryType: target.category,
        confidence: candidate.confidence ?? target.confidence,
        sourceCallId: input.callId,
        changeReason: decision.reason,
      },
    });

    await tx.extractedFact.update({
      where: { id: target.id },
      data: {
        content: nextContent,
        evidence: nextEvidence,
        confidence: candidate.confidence ?? target.confidence,
      },
    });

    await tx.memoryLearningEvent.create({
      data: {
        dealId: input.dealId,
        memoryId: target.id,
        sourceCallId: input.callId,
        action: isRefine ? "REFINED" : "CONFIRMED",
        previousVersionId: latest.id,
        newVersionId: version.id,
        reason: decision.reason,
      },
    });

    await createTimeline(tx, {
      dealId: input.dealId,
      eventType: isRefine ? "MEMORY_REFINED" : "MEMORY_CONFIRMED",
      title: `${memoryLabel(target.category as FactCategory)} ${
        isRefine ? "refined" : "confirmed"
      }`,
      description: isRefine
        ? `Call ${input.callNumber} improved the understanding: ${nextContent}`
        : `New evidence from Call ${input.callNumber} supports this memory: ${
            candidate.evidence ?? candidate.content
          }`,
      sourceCallId: input.callId,
      sourceMemoryId: target.id,
      metadata: {
        category: target.category,
        callNumber: input.callNumber,
        versionNumber: version.versionNumber,
        ...(isRefine ? { previousContent: target.content } : {}),
      },
      createdAt: nextEventTime(),
    });

    if (isRefine) {
      result.refined += 1;
    } else {
      result.confirmed += 1;
    }
  }

  return result;
}
