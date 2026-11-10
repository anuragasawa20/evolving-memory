import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FACT_SINGULAR } from "@/lib/display";
import type { FactCategory, MemorySyncStatus } from "@/types/deal";
import type {
  MemoryDetail,
  MemoryExplorerData,
  MemoryGraphEdge,
  MemoryGraphNode,
  MemoryLearningEventView,
  MemoryVersionView,
  RecommendationDetail,
  TimelineEventView,
} from "@/types/memory";

function toMetadata(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function callRef(
  call: { id: string; callNumber: number; title: string | null } | null,
) {
  return call
    ? { id: call.id, callNumber: call.callNumber, title: call.title }
    : null;
}

function versionView(version: {
  id: string;
  versionNumber: number;
  content: string;
  evidence: string | null;
  memoryType: string;
  confidence: Prisma.Decimal | null;
  changeReason: string | null;
  createdAt: Date;
  sourceCall: { id: string; callNumber: number; title: string | null } | null;
}): MemoryVersionView {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    content: version.content,
    evidence: version.evidence,
    memoryType: version.memoryType as FactCategory,
    confidence: version.confidence ? Number(version.confidence) : null,
    sourceCall: callRef(version.sourceCall),
    changeReason: version.changeReason,
    createdAt: version.createdAt.toISOString(),
  };
}

function learningEventView(event: {
  id: string;
  action: string;
  reason: string | null;
  createdAt: Date;
  sourceCall: { id: string; callNumber: number; title: string | null } | null;
  previousVersion: Parameters<typeof versionView>[0] | null;
  newVersion: Parameters<typeof versionView>[0] | null;
}): MemoryLearningEventView {
  return {
    id: event.id,
    action: event.action as MemoryLearningEventView["action"],
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
    sourceCall: callRef(event.sourceCall),
    previousVersion: event.previousVersion
      ? versionView(event.previousVersion)
      : null,
    newVersion: event.newVersion ? versionView(event.newVersion) : null,
  };
}

export async function getMemoryExplorer(
  dealId: string,
): Promise<MemoryExplorerData | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      calls: {
        orderBy: { callNumber: "asc" },
        include: { memorySync: true },
      },
      facts: {
        orderBy: { createdAt: "asc" },
        include: {
          call: { select: { callNumber: true } },
          _count: { select: { versions: true } },
        },
      },
      recommendations: {
        orderBy: { createdAt: "asc" },
        include: {
          memories: {
            include: {
              memory: { select: { id: true, category: true, content: true } },
            },
          },
        },
      },
      timelineEvents: {
        orderBy: { createdAt: "desc" },
        include: {
          sourceCall: { select: { id: true, callNumber: true, title: true } },
          sourceMemory: {
            select: { id: true, category: true, content: true },
          },
        },
      },
    },
  });

  if (!deal) return null;

  const [relationships, techniques, learningCounts] = await Promise.all([
    prisma.memoryRelationship.findMany({
      where: {
        OR: [
          { sourceMemory: { dealId } },
          { targetMemory: { dealId } },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.personalTechnique.findMany({
      where: { OR: [{ dealId: null }, { dealId }] },
      orderBy: { createdAt: "asc" },
    }),
    prisma.memoryLearningEvent.groupBy({
      by: ["action"],
      where: { dealId },
      _count: { _all: true },
    }),
  ]);

  const memoryIds = new Set(deal.facts.map((fact) => fact.id));
  const nodes: MemoryGraphNode[] = [];
  const edges: MemoryGraphEdge[] = [];

  nodes.push({
    id: `deal:${deal.id}`,
    type: "deal",
    data: {
      label: deal.customerName,
      subtitle: deal.productName,
      stage: deal.stage,
      status: deal.status,
    },
  });

  for (const call of deal.calls) {
    nodes.push({
      id: `call:${call.id}`,
      type: "call",
      data: {
        label: `Call ${call.callNumber}`,
        subtitle: call.title ?? call.summary ?? "Sales conversation",
        callNumber: call.callNumber,
        callDate: call.callDate?.toISOString() ?? null,
        analysisStatus: call.analysisStatus,
        memorySyncStatus: call.memorySync?.status ?? null,
      },
    });

    edges.push({
      id: `edge:belongs:${call.id}`,
      source: `deal:${deal.id}`,
      target: `call:${call.id}`,
      type: "BELONGS_TO",
      origin: "EXPLICIT",
      label: "BELONGS_TO",
      explanation: "Call belongs to this deal",
      createdAt: call.createdAt.toISOString(),
    });
  }

  for (const fact of deal.facts) {
    nodes.push({
      id: `memory:${fact.id}`,
      type: "memory",
      data: {
        label: FACT_SINGULAR[fact.category as FactCategory] ?? "Memory",
        subtitle: fact.content,
        category: fact.category,
        content: fact.content,
        evidence: fact.evidence,
        confidence: fact.confidence ? Number(fact.confidence) : null,
        isInferred: fact.isInferred,
        callId: fact.callId,
        callNumber: fact.call.callNumber,
        versionCount: fact._count.versions,
        createdAt: fact.createdAt.toISOString(),
        updatedAt: fact.updatedAt.toISOString(),
      },
    });

    edges.push({
      id: `edge:discovered:${fact.id}`,
      source: `call:${fact.callId}`,
      target: `memory:${fact.id}`,
      type: "DISCOVERED_IN",
      origin: "EXPLICIT",
      label: "DISCOVERED_IN",
      explanation: `Memory originated in Call ${fact.call.callNumber}`,
      createdAt: fact.createdAt.toISOString(),
    });
  }

  for (const technique of techniques) {
    nodes.push({
      id: `technique:${technique.id}`,
      type: "technique",
      data: {
        label: technique.name,
        subtitle: technique.description,
        source: technique.source,
        memoryId: technique.memoryId,
        createdAt: technique.createdAt.toISOString(),
      },
    });

    if (technique.memoryId && memoryIds.has(technique.memoryId)) {
      edges.push({
        id: `edge:addresses:${technique.id}`,
        source: `technique:${technique.id}`,
        target: `memory:${technique.memoryId}`,
        type: "ADDRESSES",
        origin: "EXPLICIT",
        label: "ADDRESSES",
        explanation: "Personal technique addresses this customer situation",
        createdAt: technique.createdAt.toISOString(),
      });
    }
  }

  for (const recommendation of deal.recommendations) {
    nodes.push({
      id: `recommendation:${recommendation.id}`,
      type: "recommendation",
      data: {
        label: "Next action",
        subtitle: recommendation.content,
        status: recommendation.status,
        createdAt: recommendation.createdAt.toISOString(),
      },
    });

    for (const link of recommendation.memories) {
      if (!memoryIds.has(link.memoryId)) continue;
      edges.push({
        id: `edge:influenced:${recommendation.id}:${link.memoryId}`,
        source: `memory:${link.memoryId}`,
        target: `recommendation:${recommendation.id}`,
        type: "INFLUENCED",
        origin: "EXPLICIT",
        label: "INFLUENCED",
        explanation: link.contribution,
        createdAt: recommendation.createdAt.toISOString(),
      });
    }
  }

  for (const relationship of relationships) {
    if (
      !memoryIds.has(relationship.sourceMemoryId) ||
      !memoryIds.has(relationship.targetMemoryId)
    ) {
      continue;
    }
    edges.push({
      id: `edge:relationship:${relationship.id}`,
      source: `memory:${relationship.sourceMemoryId}`,
      target: `memory:${relationship.targetMemoryId}`,
      type: relationship.relationshipType,
      origin: relationship.origin,
      label: relationship.relationshipType,
      explanation: relationship.explanation,
      createdAt: relationship.createdAt.toISOString(),
    });
  }

  const learningByAction = new Map(
    learningCounts.map((row) => [row.action, row._count._all]),
  );

  const syncs = deal.calls
    .map((call) => call.memorySync)
    .filter((sync): sync is NonNullable<typeof sync> => sync !== null);
  const completedSyncs = syncs.filter(
    (sync) => sync.status === "COMPLETED",
  ).length;
  const failedSyncs = syncs.filter((sync) => sync.status === "FAILED").length;

  const timeline: TimelineEventView[] = deal.timelineEvents.map((event) => {
    const metadata = toMetadata(event.metadata);
    const relatedNodeIds = new Set<string>();
    const add = (id: string | null | undefined) => {
      if (id) relatedNodeIds.add(id);
    };

    // The first related node is the primary detail target for a timeline click.
    if (event.eventType.startsWith("MEMORY_")) {
      add(event.sourceMemoryId ? `memory:${event.sourceMemoryId}` : null);
      add(
        typeof metadata?.newMemoryId === "string"
          ? `memory:${metadata.newMemoryId}`
          : null,
      );
      add(event.sourceCallId ? `call:${event.sourceCallId}` : null);
    } else if (event.eventType === "RECOMMENDATION_GENERATED") {
      add(
        event.recommendationId
          ? `recommendation:${event.recommendationId}`
          : null,
      );
      add(event.sourceCallId ? `call:${event.sourceCallId}` : null);
    } else if (event.eventType === "TECHNIQUE_ADDED") {
      add(
        typeof metadata?.techniqueId === "string"
          ? `technique:${metadata.techniqueId}`
          : null,
      );
      add(event.sourceMemoryId ? `memory:${event.sourceMemoryId}` : null);
      add(event.sourceCallId ? `call:${event.sourceCallId}` : null);
    } else {
      add(event.sourceCallId ? `call:${event.sourceCallId}` : null);
      add(event.sourceMemoryId ? `memory:${event.sourceMemoryId}` : null);
    }

    const memoryIdsInMetadata = metadata?.memoryIds;
    if (Array.isArray(memoryIdsInMetadata)) {
      for (const id of memoryIdsInMetadata) {
        if (typeof id === "string") relatedNodeIds.add(`memory:${id}`);
      }
    }
    if (event.recommendationId) {
      relatedNodeIds.add(`recommendation:${event.recommendationId}`);
    }
    if (typeof metadata?.techniqueId === "string") {
      relatedNodeIds.add(`technique:${metadata.techniqueId}`);
    }

    const syncStatus: MemorySyncStatus | null =
      event.eventType === "MEMORY_SYNCED"
        ? "COMPLETED"
        : event.eventType === "MEMORY_SYNC_FAILED"
          ? "FAILED"
          : null;

    return {
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt.toISOString(),
      sourceCall: callRef(event.sourceCall),
      sourceMemory: event.sourceMemory
        ? {
            id: event.sourceMemory.id,
            category: event.sourceMemory.category as FactCategory,
            content: event.sourceMemory.content,
          }
        : null,
      recommendationId: event.recommendationId,
      metadata,
      syncStatus,
      relatedNodeIds: Array.from(relatedNodeIds),
    };
  });

  const hasProcessing = deal.calls.some(
    (call) =>
      call.analysisStatus === "PENDING" ||
      call.analysisStatus === "PROCESSING" ||
      call.memorySync?.status === "PENDING" ||
      call.memorySync?.status === "PROCESSING",
  );

  return {
    deal: {
      id: deal.id,
      customerName: deal.customerName,
      productName: deal.productName,
      description: deal.description,
      stage: deal.stage,
      status: deal.status,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
    },
    summary: {
      totalCalls: deal.calls.length,
      totalMemories: deal.facts.length,
      totalCreated: learningByAction.get("CREATED") ?? 0,
      totalConfirmed: learningByAction.get("CONFIRMED") ?? 0,
      totalRefined: learningByAction.get("REFINED") ?? 0,
      totalContradicted: learningByAction.get("CONTRADICTED") ?? 0,
      totalRecommendations: deal.recommendations.length,
      totalTechniques: techniques.length,
      memorySync: {
        total: syncs.length,
        completed: completedSyncs,
        failed: failedSyncs,
        pending: Math.max(syncs.length - completedSyncs - failedSyncs, 0),
      },
    },
    graph: { nodes, edges },
    timeline,
    hasProcessing,
  };
}

export async function getMemoryDetail(
  dealId: string,
  memoryId: string,
): Promise<MemoryDetail | null> {
  const memory = await prisma.extractedFact.findFirst({
    where: { id: memoryId, dealId },
    include: {
      call: { select: { id: true, callNumber: true, title: true } },
      versions: {
        orderBy: { versionNumber: "desc" },
        include: {
          sourceCall: { select: { id: true, callNumber: true, title: true } },
        },
      },
      sourceRelationships: {
        include: {
          targetMemory: {
            select: { id: true, category: true, content: true },
          },
        },
      },
      targetRelationships: {
        include: {
          sourceMemory: {
            select: { id: true, category: true, content: true },
          },
        },
      },
      learningEvents: {
        orderBy: { createdAt: "desc" },
        include: {
          sourceCall: { select: { id: true, callNumber: true, title: true } },
          previousVersion: {
            include: {
              sourceCall: {
                select: { id: true, callNumber: true, title: true },
              },
            },
          },
          newVersion: {
            include: {
              sourceCall: {
                select: { id: true, callNumber: true, title: true },
              },
            },
          },
        },
      },
      recommendationLinks: {
        include: {
          recommendation: {
            select: {
              id: true,
              content: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
      techniques: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!memory) return null;

  const versions = memory.versions.map(versionView);

  const relatedMemories = [
    ...memory.sourceRelationships.map((relationship) => ({
      id: relationship.targetMemory.id,
      category: relationship.targetMemory.category as FactCategory,
      content: relationship.targetMemory.content,
      relationshipType: relationship.relationshipType,
      direction: "outgoing" as const,
      origin: relationship.origin,
      explanation: relationship.explanation,
      createdAt: relationship.createdAt.toISOString(),
    })),
    ...memory.targetRelationships.map((relationship) => ({
      id: relationship.sourceMemory.id,
      category: relationship.sourceMemory.category as FactCategory,
      content: relationship.sourceMemory.content,
      relationshipType: relationship.relationshipType,
      direction: "incoming" as const,
      origin: relationship.origin,
      explanation: relationship.explanation,
      createdAt: relationship.createdAt.toISOString(),
    })),
  ];

  return {
    id: memory.id,
    dealId: memory.dealId,
    category: memory.category as FactCategory,
    content: memory.content,
    evidence: memory.evidence,
    confidence: memory.confidence ? Number(memory.confidence) : null,
    isInferred: memory.isInferred,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
    sourceCall: callRef(memory.call),
    versions,
    previousVersion: versions[1] ?? null,
    relatedMemories,
    learningEvents: memory.learningEvents.map(learningEventView),
    recommendations: memory.recommendationLinks.map((link) => ({
      id: link.recommendation.id,
      content: link.recommendation.content,
      status: link.recommendation.status,
      contribution: link.contribution,
      createdAt: link.recommendation.createdAt.toISOString(),
    })),
    techniques: memory.techniques.map((technique) => ({
      id: technique.id,
      name: technique.name,
      description: technique.description,
      source: technique.source,
      createdAt: technique.createdAt.toISOString(),
    })),
  };
}

export async function getRecommendationDetail(
  dealId: string,
  recommendationId: string,
): Promise<RecommendationDetail | null> {
  const recommendation = await prisma.recommendation.findFirst({
    where: { id: recommendationId, dealId },
    include: {
      call: { select: { id: true, callNumber: true, title: true } },
      caseInstance: { include: { category: true } },
      playbookVersion: {
        include: { playbook: true, recommendedStrategy: true },
      },
      memories: {
        include: {
          memory: {
            select: {
              id: true,
              category: true,
              content: true,
              evidence: true,
              confidence: true,
            },
          },
        },
      },
    },
  });

  if (!recommendation) return null;

  const metadata = toMetadata(recommendation.metadata);
  const techniqueIds = Array.isArray(metadata?.techniqueIds)
    ? metadata.techniqueIds.filter((id): id is string => typeof id === "string")
    : [];
  const influencingMemoryIds = recommendation.memories.map(
    (link) => link.memoryId,
  );

  const techniqueFilters = [
    ...(techniqueIds.length > 0 ? [{ id: { in: techniqueIds } }] : []),
    ...(influencingMemoryIds.length > 0
      ? [{ memoryId: { in: influencingMemoryIds } }]
      : []),
  ];
  const techniques =
    techniqueFilters.length > 0
      ? await prisma.personalTechnique.findMany({
          where: { OR: techniqueFilters },
          orderBy: { createdAt: "asc" },
        })
      : [];

  return {
    id: recommendation.id,
    dealId: recommendation.dealId,
    callId: recommendation.callId,
    content: recommendation.content,
    reasoning: recommendation.reasoning,
    status: recommendation.status,
    createdAt: recommendation.createdAt.toISOString(),
    uncertainty:
      typeof metadata?.uncertainty === "string" ? metadata.uncertainty : null,
    nextStep: typeof metadata?.nextStep === "string" ? metadata.nextStep : null,
    confidence:
      typeof metadata?.confidence === "number" ? metadata.confidence : null,
    organizationalEvidence:
      typeof metadata?.organizationalEvidence === "string"
        ? metadata.organizationalEvidence
        : null,
    call: callRef(recommendation.call),
    caseContext: recommendation.caseInstance
      ? {
          id: recommendation.caseInstance.id,
          categoryCode: recommendation.caseInstance.category.code,
          categoryName: recommendation.caseInstance.category.name,
          subtype: recommendation.caseInstance.subtype,
          description: recommendation.caseInstance.description,
        }
      : null,
    playbook: recommendation.playbookVersion
      ? {
          id: recommendation.playbookVersion.playbook.id,
          versionId: recommendation.playbookVersion.id,
          title: recommendation.playbookVersion.playbook.title,
          strategyName:
            recommendation.playbookVersion.recommendedStrategy?.name ?? null,
          status: recommendation.playbookVersion.playbook.status,
        }
      : null,
    memories: recommendation.memories.map((link) => ({
      id: link.memory.id,
      category: link.memory.category as FactCategory,
      content: link.memory.content,
      evidence: link.memory.evidence,
      confidence: link.memory.confidence ? Number(link.memory.confidence) : null,
      contribution: link.contribution,
    })),
    techniques: techniques.map((technique) => ({
      id: technique.id,
      name: technique.name,
      description: technique.description,
      source: technique.source,
      createdAt: technique.createdAt.toISOString(),
    })),
  };
}

export async function updateRecommendationStatus(
  dealId: string,
  recommendationId: string,
  status:
    | "SUGGESTED"
    | "ACCEPTED"
    | "MODIFIED"
    | "DISMISSED"
    | "EXECUTED"
    | "OUTCOME_PENDING"
    | "OUTCOME_RECORDED",
): Promise<RecommendationDetail | null> {
  const existing = await prisma.recommendation.findFirst({
    where: { id: recommendationId, dealId },
    include: {
      caseInstance: {
        select: { id: true, salespersonId: true },
      },
    },
  });
  if (!existing) return null;

  let nextStatus = status;

  // Execution is distinct from acceptance. Marking a recommendation executed
  // creates a real strategy-execution record so outcomes can be observed later.
  if (status === "EXECUTED" && existing.caseInstanceId) {
    const metadata = toMetadata(existing.metadata);
    const strategyId =
      typeof metadata?.recommendedStrategyId === "string"
        ? metadata.recommendedStrategyId
        : null;

    if (strategyId) {
      const alreadyExecuted = await prisma.strategyExecution.findFirst({
        where: { recommendationId },
        select: { id: true },
      });

      if (!alreadyExecuted) {
        await prisma.strategyExecution.create({
          data: {
            caseInstanceId: existing.caseInstanceId,
            strategyId,
            recommendationId,
            salespersonId: existing.caseInstance?.salespersonId ?? null,
            executionStatus: "OUTCOME_PENDING",
            decisionSource: "DEALOS_RECOMMENDED",
            actualApproach: existing.content,
            executedAt: new Date(),
            isSynthetic: false,
          },
        });
      }
      nextStatus = "OUTCOME_PENDING";
    }
  }

  await prisma.recommendation.update({
    where: { id: recommendationId },
    data: { status: nextStatus },
  });

  return getRecommendationDetail(dealId, recommendationId);
}
