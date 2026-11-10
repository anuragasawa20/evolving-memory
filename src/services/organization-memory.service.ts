import type { MemWal } from "@mysten-incubation/memwal";
import { Prisma } from "@prisma/client";
import { MEMORY_NAMESPACES } from "@/lib/env";
import { createMemoryClient } from "@/lib/memory";
import { prisma } from "@/lib/prisma";
import { toSafeError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import type { MemorySyncStatus } from "@/types/deal";
import type { OrganizationEntityType } from "@prisma/client";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function truncate(value: string | null | undefined, length = 1_500): string {
  if (!value) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > length ? `${compact.slice(0, length)}…` : compact;
}

function organizationNamespace(): string {
  return process.env.MEMWAL_ORGANIZATION_NAMESPACE ?? MEMORY_NAMESPACES.organization;
}

function learningNamespace(): string {
  return process.env.MEMWAL_LEARNING_NAMESPACE ?? MEMORY_NAMESPACES.learning;
}

export function buildCaseMemoryText(input: {
  organizationId: string;
  caseInstance: {
    id: string;
    subtype: string;
    description: string;
    evidence: string | null;
    confidence: Prisma.Decimal | null;
    dealStage: string | null;
    severity: string | null;
    isSynthetic: boolean;
    createdAt: Date;
  };
  categoryCode: string;
  categoryName: string;
  deal: { id: string; productName: string; stage: string };
  call: { id: string; callNumber: number; callDate: Date | null };
  salesperson: { name: string } | null;
  executions: {
    executionStatus: string;
    actualApproach: string;
    strategyName: string;
    strategyType: string;
    outcomes: { outcomeType: string; evidence: string | null; isInferred: boolean }[];
  }[];
}): string {
  const lines = [
    `Org ID: ${input.organizationId}`,
    "Memory type: Organizational case instance",
    `Case code: ${input.categoryCode}`,
    `Case name: ${input.categoryName}`,
    `Case subtype: ${input.caseInstance.subtype}`,
    `Case ID: ${input.caseInstance.id}`,
    `Deal reference: ${input.deal.id}`,
    `Product: ${input.deal.productName}`,
    `Deal stage: ${input.caseInstance.dealStage ?? input.deal.stage}`,
    `Severity: ${input.caseInstance.severity ?? "UNSPECIFIED"}`,
    `Confidence: ${
      input.caseInstance.confidence
        ? Number(input.caseInstance.confidence).toFixed(2)
        : "unspecified"
    }`,
    `Source call: Call ${input.call.callNumber}`,
    `Observed date: ${(input.call.callDate ?? input.caseInstance.createdAt)
      .toISOString()
      .slice(0, 10)}`,
    `Salesperson: ${input.salesperson?.name ?? "Unknown"}`,
    `Synthetic dataset: ${input.caseInstance.isSynthetic ? "yes" : "no"}`,
    "",
    `Situation: ${truncate(input.caseInstance.description)}`,
  ];

  if (input.caseInstance.evidence) {
    lines.push(`Evidence: ${truncate(input.caseInstance.evidence)}`);
  }

  if (input.executions.length === 0) {
    lines.push("", "Strategy execution: none recorded.");
  } else {
    for (const execution of input.executions) {
      lines.push(
        "",
        `Strategy: ${execution.strategyName} (${execution.strategyType})`,
        `Execution status: ${execution.executionStatus}`,
        `Actual approach: ${truncate(execution.actualApproach)}`,
      );
      if (execution.outcomes.length === 0) {
        lines.push("Outcome: not yet observed.");
      } else {
        for (const outcome of execution.outcomes) {
          lines.push(
            `Outcome: ${outcome.outcomeType}${
              outcome.isInferred ? " (inferred)" : " (observed)"
            }`,
          );
          if (outcome.evidence) {
            lines.push(`Outcome evidence: ${truncate(outcome.evidence)}`);
          }
        }
      }
    }
  }

  lines.push(
    "",
    "Privacy: does not contain the raw transcript or the customer's name.",
  );

  return lines.join("\n");
}

export function buildPlaybookMemoryText(input: {
  organizationId: string;
  playbook: {
    id: string;
    title: string;
    description: string;
    status: string;
    currentVersion: number;
  };
  version: {
    id: string;
    version: number;
    guidance: string;
    conditions: string;
    exceptions: string;
    evidenceSummary: string;
    confidence: Prisma.Decimal | null;
    approvalStatus: string;
  };
  categoryCode: string;
  categoryName: string;
  subtype: string;
  strategy: { name: string; description: string; strategyType: string } | null;
  evidenceCount: number;
}): string {
  return [
    `Org ID: ${input.organizationId}`,
    "Memory type: Organizational playbook version",
    `Playbook ID: ${input.playbook.id}`,
    `Title: ${input.playbook.title}`,
    `Case code: ${input.categoryCode}`,
    `Case name: ${input.categoryName}`,
    `Case subtype: ${input.subtype}`,
    `Playbook status: ${input.playbook.status}`,
    `Version: ${input.version.version}`,
    `Approval status: ${input.version.approvalStatus}`,
    `Confidence: ${
      input.version.confidence
        ? Number(input.version.confidence).toFixed(2)
        : "unspecified"
    }`,
    `Evidence items: ${input.evidenceCount}`,
    "",
    `Situation: ${truncate(input.playbook.description)}`,
    `Recommended strategy: ${
      input.strategy
        ? `${input.strategy.name} (${input.strategy.strategyType})`
        : "Not selected"
    }`,
    `Guidance: ${truncate(input.version.guidance, 2_000)}`,
    `When to use: ${truncate(input.version.conditions, 2_000)}`,
    `When not to use / exceptions: ${truncate(input.version.exceptions, 2_000)}`,
    `Evidence summary: ${truncate(input.version.evidenceSummary, 2_000)}`,
    "",
    "Privacy: synthesized from anonymized case evidence; contains no raw transcript or customer name.",
  ].join("\n");
}

export function buildTechniqueMemoryText(input: {
  organizationId: string;
  technique: {
    id: string;
    name: string;
    description: string;
    source: string | null;
    createdAt: Date;
  };
}): string {
  return [
    `Org ID: ${input.organizationId}`,
    "Memory type: Personal learning technique",
    `Technique ID: ${input.technique.id}`,
    `Technique: ${input.technique.name}`,
    `Source: ${input.technique.source ?? "Self-recorded"}`,
    `Recorded date: ${input.technique.createdAt.toISOString().slice(0, 10)}`,
    "",
    `Guidance: ${truncate(input.technique.description, 2_000)}`,
    "",
    "Privacy: personal learning memory owned by the salesperson.",
  ].join("\n");
}

async function markSync(
  syncId: string,
  data: {
    status: MemorySyncStatus;
    errorMessage?: string | null;
    blobReferences?: unknown;
    syncedAt?: Date | null;
  },
) {
  return prisma.organizationMemorySync.update({
    where: { id: syncId },
    data: {
      status: data.status,
      errorMessage: data.errorMessage ?? null,
      blobReferences:
        data.blobReferences === undefined
          ? undefined
          : toJsonValue(data.blobReferences),
      syncedAt: data.syncedAt ?? null,
    },
  });
}

async function beginSync(input: {
  organizationId: string;
  entityType: OrganizationEntityType;
  entityId: string;
  namespace: string;
}) {
  return prisma.organizationMemorySync.upsert({
    where: {
      entityType_entityId_namespace: {
        entityType: input.entityType,
        entityId: input.entityId,
        namespace: input.namespace,
      },
    },
    create: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      namespace: input.namespace,
      status: "PROCESSING",
      attempts: 1,
    },
    update: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      errorMessage: null,
    },
  });
}

export interface OrganizationMemorySyncResult {
  status: MemorySyncStatus;
  errorMessage?: string;
}

export async function syncCaseInstanceMemory(
  caseInstanceId: string,
): Promise<OrganizationMemorySyncResult | null> {
  const startedAt = Date.now();
  const caseInstance = await prisma.caseInstance.findUnique({
    where: { id: caseInstanceId },
    include: {
      category: true,
      deal: { select: { id: true, productName: true, stage: true } },
      call: { select: { id: true, callNumber: true, callDate: true } },
      salesperson: { select: { name: true } },
      executions: {
        include: {
          strategy: true,
          outcomes: true,
        },
      },
    },
  });

  if (!caseInstance) return null;

  const namespace = organizationNamespace();
  const sync = await beginSync({
    organizationId: caseInstance.organizationId,
    entityType: "CASE_INSTANCE",
    entityId: caseInstance.id,
    namespace,
  });

  const text = buildCaseMemoryText({
    organizationId: caseInstance.organizationId,
    caseInstance,
    categoryCode: caseInstance.category.code,
    categoryName: caseInstance.category.name,
    deal: caseInstance.deal,
    call: caseInstance.call,
    salesperson: caseInstance.salesperson,
    executions: caseInstance.executions.map((execution) => ({
      executionStatus: execution.executionStatus,
      actualApproach: execution.actualApproach,
      strategyName: execution.strategy.name,
      strategyType: execution.strategy.strategyType,
      outcomes: execution.outcomes.map((outcome) => ({
        outcomeType: outcome.outcomeType,
        evidence: outcome.evidence,
        isInferred: outcome.isInferred,
      })),
    })),
  });

  let client: MemWal | null = null;
  try {
    client = createMemoryClient(namespace);
    const result = await client.rememberAndWait(text, namespace);

    await markSync(sync.id, {
      status: "COMPLETED",
      blobReferences: {
        blobId: result.blob_id,
        jobId: result.job_id,
        owner: result.owner,
      },
      syncedAt: new Date(),
    });

    logIntegration({
      service: "walrus",
      operation: "sync_case_instance_memory",
      ok: true,
      message: "Organizational case memory persisted to Walrus",
      durationMs: Date.now() - startedAt,
      meta: {
        organizationId: caseInstance.organizationId,
        caseInstanceId,
        namespace,
        blobId: result.blob_id,
      },
    });

    return { status: "COMPLETED" };
  } catch (error) {
    const safe = toSafeError(error);
    await markSync(sync.id, { status: "FAILED", errorMessage: safe.message });
    logIntegration({
      service: "walrus",
      operation: "sync_case_instance_memory",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: {
        organizationId: caseInstance.organizationId,
        caseInstanceId,
        namespace,
      },
    });
    return { status: "FAILED", errorMessage: safe.message };
  } finally {
    client?.destroy();
  }
}

export async function syncPlaybookVersionMemory(
  playbookVersionId: string,
): Promise<OrganizationMemorySyncResult | null> {
  const startedAt = Date.now();
  const version = await prisma.playbookVersion.findUnique({
    where: { id: playbookVersionId },
    include: {
      playbook: {
        include: {
          organization: true,
          caseCategory: true,
        },
      },
      recommendedStrategy: true,
      _count: { select: { evidence: true } },
    },
  });

  if (!version) return null;

  const namespace = organizationNamespace();
  const sync = await beginSync({
    organizationId: version.playbook.organizationId,
    entityType: "PLAYBOOK_VERSION",
    entityId: version.id,
    namespace,
  });

  const text = buildPlaybookMemoryText({
    organizationId: version.playbook.organizationId,
    playbook: version.playbook,
    version,
    categoryCode: version.playbook.caseCategory.code,
    categoryName: version.playbook.caseCategory.name,
    subtype: version.playbook.subtype,
    strategy: version.recommendedStrategy,
    evidenceCount: version._count.evidence,
  });

  let client: MemWal | null = null;
  try {
    client = createMemoryClient(namespace);
    const result = await client.analyzeAndWait(
      text,
      { namespace, occurredAt: version.createdAt },
      { pollIntervalMs: 2_000, timeoutMs: 120_000 },
    );

    const allPersisted =
      result.total > 0 &&
      result.failed === 0 &&
      result.succeeded === result.total;

    if (!allPersisted) {
      const message =
        result.total === 0
          ? "Walrus analyzed no playbook memories"
          : `Walrus persisted ${result.succeeded}/${result.total} playbook memories`;
      await markSync(sync.id, {
        status: "FAILED",
        errorMessage: message,
        blobReferences: result,
      });
      return { status: "FAILED", errorMessage: message };
    }

    await markSync(sync.id, {
      status: "COMPLETED",
      blobReferences: result,
      syncedAt: new Date(),
    });

    logIntegration({
      service: "walrus",
      operation: "sync_playbook_version_memory",
      ok: true,
      message: "Organizational playbook version persisted to Walrus",
      durationMs: Date.now() - startedAt,
      meta: {
        organizationId: version.playbook.organizationId,
        playbookVersionId,
        namespace,
        total: result.total,
      },
    });

    return { status: "COMPLETED" };
  } catch (error) {
    const safe = toSafeError(error);
    await markSync(sync.id, { status: "FAILED", errorMessage: safe.message });
    logIntegration({
      service: "walrus",
      operation: "sync_playbook_version_memory",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: {
        organizationId: version.playbook.organizationId,
        playbookVersionId,
        namespace,
      },
    });
    return { status: "FAILED", errorMessage: safe.message };
  } finally {
    client?.destroy();
  }
}

export async function syncPersonalTechniqueMemory(
  techniqueId: string,
): Promise<OrganizationMemorySyncResult | null> {
  const startedAt = Date.now();
  const technique = await prisma.personalTechnique.findUnique({
    where: { id: techniqueId },
    include: { organization: true },
  });

  if (!technique?.organizationId) return null;

  const namespace = learningNamespace();
  const sync = await beginSync({
    organizationId: technique.organizationId,
    entityType: "PERSONAL_TECHNIQUE",
    entityId: technique.id,
    namespace,
  });

  const text = buildTechniqueMemoryText({
    organizationId: technique.organizationId,
    technique,
  });

  let client: MemWal | null = null;
  try {
    client = createMemoryClient(namespace);
    const result = await client.rememberAndWait(text, namespace);

    await markSync(sync.id, {
      status: "COMPLETED",
      blobReferences: {
        blobId: result.blob_id,
        jobId: result.job_id,
        owner: result.owner,
      },
      syncedAt: new Date(),
    });

    logIntegration({
      service: "walrus",
      operation: "sync_personal_technique_memory",
      ok: true,
      message: "Personal technique persisted to Walrus learning memory",
      durationMs: Date.now() - startedAt,
      meta: {
        organizationId: technique.organizationId,
        techniqueId,
        namespace,
        blobId: result.blob_id,
      },
    });

    return { status: "COMPLETED" };
  } catch (error) {
    const safe = toSafeError(error);
    await markSync(sync.id, { status: "FAILED", errorMessage: safe.message });
    logIntegration({
      service: "walrus",
      operation: "sync_personal_technique_memory",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: {
        organizationId: technique.organizationId,
        techniqueId,
        namespace,
      },
    });
    return { status: "FAILED", errorMessage: safe.message };
  } finally {
    client?.destroy();
  }
}

export interface WalrusRecallResult {
  blobId: string;
  text: string;
  distance: number;
  createdAt?: string;
}

export async function recallOrganizationMemories(
  organizationId: string,
  query: string,
  limit = 10,
): Promise<{ namespace: string; query: string; results: WalrusRecallResult[] }> {
  const namespace = organizationNamespace();
  let client: MemWal | null = null;
  try {
    client = createMemoryClient(namespace);
    const result = await client.recall({
      query: `Org ID: ${organizationId}. ${query}`,
      limit,
      namespace,
    });

    return {
      namespace,
      query,
      results: result.results
        .filter((memory) => memory.text.includes(organizationId))
        .map((memory) => ({
          blobId: memory.blob_id,
          text: memory.text,
          distance: memory.distance,
          createdAt: memory.created_at,
        })),
    };
  } finally {
    client?.destroy();
  }
}

export async function recallPersonalLearningMemories(
  organizationId: string,
  query: string,
  limit = 10,
): Promise<{ namespace: string; query: string; results: WalrusRecallResult[] }> {
  const namespace = learningNamespace();
  let client: MemWal | null = null;
  try {
    client = createMemoryClient(namespace);
    const result = await client.recall({
      query: `Org ID: ${organizationId}. ${query}`,
      limit,
      namespace,
    });

    return {
      namespace,
      query,
      results: result.results
        .filter((memory) => memory.text.includes(organizationId))
        .map((memory) => ({
          blobId: memory.blob_id,
          text: memory.text,
          distance: memory.distance,
          createdAt: memory.created_at,
        })),
    };
  } finally {
    client?.destroy();
  }
}

export async function recallCombinedOrganizationMemory(
  organizationId: string,
  query: string,
  limit = 10,
) {
  const [organization, learning] = await Promise.all([
    recallOrganizationMemories(organizationId, query, limit).catch(() => null),
    recallPersonalLearningMemories(organizationId, query, limit).catch(() => null),
  ]);

  const results = [
    ...(organization?.results ?? []).map((result) => ({
      ...result,
      namespace: organization!.namespace,
      memoryType: "ORGANIZATION",
    })),
    ...(learning?.results ?? []).map((result) => ({
      ...result,
      namespace: learning!.namespace,
      memoryType: "PERSONAL_LEARNING",
    })),
  ]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return {
    query,
    namespaces: [organization?.namespace, learning?.namespace].filter(
      (value): value is string => Boolean(value),
    ),
    results,
    organizationAvailable: Boolean(organization),
    learningAvailable: Boolean(learning),
  };
}

export async function retryOrganizationMemorySync(
  syncId: string,
): Promise<OrganizationMemorySyncResult | null> {
  const sync = await prisma.organizationMemorySync.findUnique({
    where: { id: syncId },
  });
  if (!sync) return null;

  if (sync.entityType === "CASE_INSTANCE") {
    return syncCaseInstanceMemory(sync.entityId);
  }
  if (sync.entityType === "PLAYBOOK_VERSION") {
    return syncPlaybookVersionMemory(sync.entityId);
  }
  return syncPersonalTechniqueMemory(sync.entityId);
}

export async function syncPendingOrganizationMemories(
  organizationId: string,
  limit = 10,
) {
  const pending = await prisma.organizationMemorySync.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "FAILED"] },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results = [];
  for (const sync of pending) {
    const result = await retryOrganizationMemorySync(sync.id);
    results.push({ syncId: sync.id, ...(result ?? { status: "NOT_FOUND" }) });
  }
  return results;
}

export async function getOrganizationMemoryStatus(organizationId: string) {
  const [byStatus, byEntityType, byNamespace, recent] = await Promise.all([
    prisma.organizationMemorySync.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.organizationMemorySync.groupBy({
      by: ["entityType"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.organizationMemorySync.groupBy({
      by: ["namespace"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.organizationMemorySync.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const caseIds = recent
    .filter((sync) => sync.entityType === "CASE_INSTANCE")
    .map((sync) => sync.entityId);
  const playbookVersionIds = recent
    .filter((sync) => sync.entityType === "PLAYBOOK_VERSION")
    .map((sync) => sync.entityId);
  const techniqueIds = recent
    .filter((sync) => sync.entityType === "PERSONAL_TECHNIQUE")
    .map((sync) => sync.entityId);

  const [cases, versions, techniques] = await Promise.all([
    caseIds.length
      ? prisma.caseInstance.findMany({
          where: { id: { in: caseIds } },
          include: { category: { select: { name: true } } },
        })
      : Promise.resolve([]),
    playbookVersionIds.length
      ? prisma.playbookVersion.findMany({
          where: { id: { in: playbookVersionIds } },
          include: { playbook: { select: { title: true } } },
        })
      : Promise.resolve([]),
    techniqueIds.length
      ? prisma.personalTechnique.findMany({
          where: { id: { in: techniqueIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const caseLabels = new Map(
    cases.map((item) => [
      item.id,
      `${item.category.name} · ${item.subtype}`,
    ]),
  );
  const versionLabels = new Map(
    versions.map((item) => [
      item.id,
      `${item.playbook.title} · v${item.version}`,
    ]),
  );
  const techniqueLabels = new Map(
    techniques.map((item) => [item.id, item.name]),
  );

  const statusCounts = {
    total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
    completed:
      byStatus.find((row) => row.status === "COMPLETED")?._count._all ?? 0,
    failed: byStatus.find((row) => row.status === "FAILED")?._count._all ?? 0,
    pending:
      (byStatus.find((row) => row.status === "PENDING")?._count._all ?? 0) +
      (byStatus.find((row) => row.status === "PROCESSING")?._count._all ?? 0),
  };

  return {
    statusCounts,
    entityCounts: byEntityType.map((row) => ({
      entityType: row.entityType,
      count: row._count._all,
    })),
    namespaceCounts: byNamespace.map((row) => ({
      namespace: row.namespace,
      count: row._count._all,
    })),
    mainnet: {
      walrusBlobBaseUrl: "https://walruscan.com/mainnet/blob/",
      walrusExplorerUrl: "https://walruscan.com/mainnet",
      suiObjectBaseUrl: "https://suiscan.xyz/mainnet/object/",
      suiAccountBaseUrl: "https://suiscan.xyz/mainnet/account/",
      memoryAccountId: process.env.MEMWAL_ACCOUNT_ID ?? null,
    },
    recent: recent.map((sync) => ({
      id: sync.id,
      entityType: sync.entityType,
      entityId: sync.entityId,
      entityLabel:
        sync.entityType === "CASE_INSTANCE"
          ? (caseLabels.get(sync.entityId) ?? "Case instance")
          : sync.entityType === "PLAYBOOK_VERSION"
            ? (versionLabels.get(sync.entityId) ?? "Playbook version")
            : (techniqueLabels.get(sync.entityId) ?? "Personal technique"),
      namespace: sync.namespace,
      status: sync.status,
      attempts: sync.attempts,
      blobReferences: sync.blobReferences,
      errorMessage: sync.errorMessage,
      syncedAt: sync.syncedAt?.toISOString() ?? null,
      updatedAt: sync.updatedAt.toISOString(),
    })),
  };
}
