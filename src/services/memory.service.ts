import type { MemWal } from "@mysten-incubation/memwal";
import { Prisma } from "@prisma/client";
import {
  buildCallMemoryText,
  buildMemoryRecallQuery,
  createMemoryClient,
  getMemoryEnv,
  type MemoryFactInput,
} from "@/lib/memory";
import { MEMORY_NAMESPACES } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { toSafeError } from "@/lib/errors";
import { buildHealth } from "@/lib/health";
import { logIntegration } from "@/lib/logger";
import type {
  MemorySyncStatus,
  RecallResponse,
} from "@/types/deal";
import type { MemoryTestDetails, ServiceHealth } from "@/types/infrastructure";

export const TEST_MEMORY_TEXT =
  "DealOS infrastructure test: The demo gym owner is concerned about manual membership renewal reminders. This is a synthetic test record.";

export const TEST_RECALL_QUERY =
  "What is the demo gym owner concerned about regarding membership renewal reminders?";

const TEST_NAMESPACE = MEMORY_NAMESPACES.deals;

const RELEVANCE_PATTERN = /renewal|reminder|gym|membership|synthetic/i;

function configMissing(
  startedAt: number,
  message: string,
  details: MemoryTestDetails,
): ServiceHealth<MemoryTestDetails> {
  return buildHealth({
    service: "walrus",
    status: "configuration_missing",
    message,
    startedAt,
    details,
    error: { code: "CONFIG_MISSING", message },
  });
}

export async function testMemoryConnection(): Promise<
  ServiceHealth<MemoryTestDetails>
> {
  const startedAt = Date.now();

  let serverUrl: string;
  try {
    serverUrl = getMemoryEnv().MEMWAL_SERVER_URL;
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "walrus",
      operation: "test_connection",
      ok: false,
      message: safe.message,
      code: safe.code,
    });
    return configMissing(startedAt, safe.message, {
      namespace: TEST_NAMESPACE,
      serverUrl: "",
    });
  }

  let client: MemWal | null = null;
  try {
    client = createMemoryClient(TEST_NAMESPACE);
    const health = await client.health();

    logIntegration({
      service: "walrus",
      operation: "test_connection",
      ok: true,
      message: "Walrus Memory relayer reachable",
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE, relayerStatus: health.status },
    });

    return buildHealth({
      service: "walrus",
      status: "connected",
      message: `Walrus Memory relayer reachable (status: ${health.status})`,
      startedAt,
      details: {
        namespace: TEST_NAMESPACE,
        serverUrl,
        relayerStatus: health.status,
      },
    });
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "walrus",
      operation: "test_connection",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE },
    });
    return buildHealth({
      service: "walrus",
      status: "disconnected",
      message: safe.message,
      startedAt,
      details: { namespace: TEST_NAMESPACE, serverUrl },
      error: safe,
    });
  } finally {
    client?.destroy();
  }
}

export async function writeTestMemory(): Promise<
  ServiceHealth<MemoryTestDetails>
> {
  const startedAt = Date.now();

  let serverUrl: string;
  try {
    serverUrl = getMemoryEnv().MEMWAL_SERVER_URL;
  } catch (error) {
    const safe = toSafeError(error);
    return configMissing(startedAt, safe.message, {
      namespace: TEST_NAMESPACE,
      serverUrl: "",
    });
  }

  let client: MemWal | null = null;
  try {
    client = createMemoryClient(TEST_NAMESPACE);
    const result = await client.rememberAndWait(TEST_MEMORY_TEXT, TEST_NAMESPACE);

    logIntegration({
      service: "walrus",
      operation: "write_test_memory",
      ok: true,
      message: "Synthetic test memory persisted",
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE, blobId: result.blob_id },
    });

    return buildHealth({
      service: "walrus",
      status: "connected",
      message: "Synthetic test memory persisted to Walrus Memory",
      startedAt,
      details: {
        namespace: TEST_NAMESPACE,
        serverUrl,
        write: {
          blobId: result.blob_id,
          jobId: result.job_id,
          owner: result.owner,
        },
      },
    });
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "walrus",
      operation: "write_test_memory",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE },
    });
    return buildHealth({
      service: "walrus",
      status: "test_failed",
      message: safe.message,
      startedAt,
      details: { namespace: TEST_NAMESPACE, serverUrl },
      error: safe,
    });
  } finally {
    client?.destroy();
  }
}

export async function recallTestMemory(): Promise<
  ServiceHealth<MemoryTestDetails>
> {
  const startedAt = Date.now();

  let serverUrl: string;
  try {
    serverUrl = getMemoryEnv().MEMWAL_SERVER_URL;
  } catch (error) {
    const safe = toSafeError(error);
    return configMissing(startedAt, safe.message, {
      namespace: TEST_NAMESPACE,
      serverUrl: "",
    });
  }

  let client: MemWal | null = null;
  try {
    client = createMemoryClient(TEST_NAMESPACE);
    const recall = await client.recall({
      query: TEST_RECALL_QUERY,
      limit: 5,
      namespace: TEST_NAMESPACE,
    });

    const top = recall.results[0];
    const relevant = recall.results.some((memory) =>
      RELEVANCE_PATTERN.test(memory.text),
    );

    logIntegration({
      service: "walrus",
      operation: "recall_test_memory",
      ok: relevant,
      message: relevant
        ? "Recalled memory matched the synthetic test record"
        : "Recall returned no relevant memory",
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE, matched: recall.results.length },
    });

    return buildHealth({
      service: "walrus",
      status: relevant ? "connected" : "test_failed",
      message: relevant
        ? "Recalled memory matched the synthetic test record"
        : "Recall returned no relevant memory",
      startedAt,
      details: {
        namespace: TEST_NAMESPACE,
        serverUrl,
        recall: {
          matched: recall.results.length,
          relevant,
          topDistance: top?.distance,
          topText: top?.text,
        },
      },
      ...(relevant
        ? {}
        : {
            error: {
              code: "INVALID_RESPONSE",
              message: "Recall did not return the stored synthetic memory",
            },
          }),
    });
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "walrus",
      operation: "recall_test_memory",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE },
    });
    return buildHealth({
      service: "walrus",
      status: "test_failed",
      message: safe.message,
      startedAt,
      details: { namespace: TEST_NAMESPACE, serverUrl },
      error: safe,
    });
  } finally {
    client?.destroy();
  }
}

/**
 * Full integration test: write a synthetic memory, wait for persistence, then
 * recall it (with a few retries to allow the search index to catch up).
 */
export async function testMemoryReadWrite(): Promise<
  ServiceHealth<MemoryTestDetails>
> {
  const startedAt = Date.now();

  let serverUrl: string;
  try {
    serverUrl = getMemoryEnv().MEMWAL_SERVER_URL;
  } catch (error) {
    const safe = toSafeError(error);
    return configMissing(startedAt, safe.message, {
      namespace: TEST_NAMESPACE,
      serverUrl: "",
    });
  }

  let client: MemWal | null = null;
  try {
    client = createMemoryClient(TEST_NAMESPACE);

    const write = await client.rememberAndWait(TEST_MEMORY_TEXT, TEST_NAMESPACE);

    let matched = 0;
    let relevant = false;
    let topDistance: number | undefined;
    let topText: string | undefined;

    for (let attempt = 0; attempt < 5 && !relevant; attempt += 1) {
      const recall = await client.recall({
        query: TEST_RECALL_QUERY,
        limit: 5,
        namespace: TEST_NAMESPACE,
      });
      matched = recall.results.length;
      topDistance = recall.results[0]?.distance;
      topText = recall.results[0]?.text;
      relevant = recall.results.some((memory) =>
        RELEVANCE_PATTERN.test(memory.text),
      );
      if (!relevant) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }

    logIntegration({
      service: "walrus",
      operation: "read_write_test",
      ok: relevant && matched > 0,
      message: relevant
        ? "Write and recall round-trip verified"
        : "Write succeeded but recall did not match",
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE, matched, blobId: write.blob_id },
    });

    return buildHealth({
      service: "walrus",
      status: relevant ? "connected" : "test_failed",
      message: relevant
        ? "Write and recall round-trip verified on Walrus Memory Mainnet"
        : "Write succeeded but recall did not return the stored memory",
      startedAt,
      details: {
        namespace: TEST_NAMESPACE,
        serverUrl,
        write: { blobId: write.blob_id, jobId: write.job_id, owner: write.owner },
        recall: { matched, relevant, topDistance, topText },
      },
      ...(relevant
        ? {}
        : {
            error: {
              code: "INVALID_RESPONSE",
              message: "Recall did not return the stored synthetic memory",
            },
          }),
    });
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "walrus",
      operation: "read_write_test",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { namespace: TEST_NAMESPACE },
    });
    return buildHealth({
      service: "walrus",
      status: "test_failed",
      message: safe.message,
      startedAt,
      details: { namespace: TEST_NAMESPACE, serverUrl },
      error: safe,
    });
  } finally {
    client?.destroy();
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface MemorySyncResult {
  status: MemorySyncStatus;
  errorMessage?: string;
  attempts?: number;
}

async function recordSyncTimeline(input: {
  dealId: string;
  callId: string;
  callNumber: number;
  eventType: "MEMORY_SYNCED" | "MEMORY_SYNC_FAILED";
  description: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.timelineEvent.create({
      data: {
        dealId: input.dealId,
        eventType: input.eventType,
        title:
          input.eventType === "MEMORY_SYNCED"
            ? "Memory synced to Walrus"
            : "Walrus memory sync failed",
        description: input.description,
        sourceCallId: input.callId,
        metadata: toJsonValue(input.metadata),
      },
    });
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "database",
      operation: "record_sync_timeline",
      ok: false,
      message: safe.message,
      code: safe.code,
      meta: { dealId: input.dealId, callId: input.callId },
    });
  }
}

/**
 * Persist one analyzed call as structured experiences in Walrus Memory.
 *
 * The PostgreSQL MemorySync row is the source of truth for the external write.
 * Only a confirmed analyzeAndWait() result with all extracted facts completed
 * can move the row to COMPLETED. Failed or partial writes are retained as
 * FAILED with their error so they can be retried later.
 */
export async function syncCallMemories(
  callId: string,
): Promise<MemorySyncResult | null> {
  const sync = await prisma.memorySync.findUnique({
    where: { callId },
    include: {
      call: {
        include: {
          deal: {
            select: { customerName: true, productName: true },
          },
          facts: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!sync) return null;

  if (sync.status === "COMPLETED") {
    return { status: "COMPLETED", attempts: sync.attempts };
  }

  const updating = await prisma.memorySync.update({
    where: { callId },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      errorMessage: null,
    },
  });

  const versions = await prisma.memoryVersion.findMany({
    where: { sourceCallId: callId },
    orderBy: { createdAt: "asc" },
  });

  // Memory versions capture confirmations and refinements that do not create a
  // new ExtractedFact. Legacy calls without versions fall back to their facts.
  const facts: MemoryFactInput[] =
    versions.length > 0
      ? versions.map((version) => ({
          category: version.memoryType,
          content: version.content,
          evidence: version.evidence,
          metadata: {
            kind: "memory_version",
            changeReason: version.changeReason,
          },
        }))
      : sync.call.facts.map((fact) => ({
          category: fact.category,
          content: fact.content,
          evidence: fact.evidence,
          metadata:
            fact.metadata &&
            typeof fact.metadata === "object" &&
            !Array.isArray(fact.metadata)
              ? (fact.metadata as Record<string, unknown>)
              : null,
        }));

  const memoryText = buildCallMemoryText({
    dealId: sync.dealId,
    callId: sync.callId,
    callNumber: sync.call.callNumber,
    customerName: sync.call.deal.customerName,
    productName: sync.call.deal.productName,
    callTitle: sync.call.title,
    observedAt: sync.call.callDate ?? sync.call.createdAt,
    summary: sync.call.summary ?? "No summary available.",
    facts,
  });

  const namespace = sync.namespace || MEMORY_NAMESPACES.deals;
  const startedAt = Date.now();
  let client: MemWal | null = null;

  try {
    client = createMemoryClient(namespace);
    const result = await client.analyzeAndWait(
      memoryText,
      {
        namespace,
        occurredAt: sync.call.callDate ?? sync.call.createdAt,
      },
      { pollIntervalMs: 2_000, timeoutMs: 120_000 },
    );

    const allPersisted =
      result.total > 0 &&
      result.failed === 0 &&
      result.succeeded === result.total;

    if (!allPersisted) {
      const message =
        result.total === 0
          ? "Walrus analyzeAndWait returned no extracted memories"
          : `Walrus persisted ${result.succeeded}/${result.total} memories (${result.failed} failed)`;

      await prisma.memorySync.update({
        where: { callId },
        data: {
          status: "FAILED",
          errorMessage: message,
          jobReferences: toJsonValue(result),
        },
      });

      logIntegration({
        service: "walrus",
        operation: "sync_call_memories",
        ok: false,
        message,
        durationMs: Date.now() - startedAt,
        meta: { dealId: sync.dealId, callId, namespace, total: result.total },
      });

      await recordSyncTimeline({
        dealId: sync.dealId,
        callId,
        callNumber: sync.call.callNumber,
        eventType: "MEMORY_SYNC_FAILED",
        description: message,
        metadata: {
          namespace,
          attempts: updating.attempts,
          total: result.total,
          succeeded: result.succeeded,
          failed: result.failed,
        },
      });

      return {
        status: "FAILED",
        errorMessage: message,
        attempts: updating.attempts,
      };
    }

    await prisma.memorySync.update({
      where: { callId },
      data: {
        status: "COMPLETED",
        syncedAt: new Date(),
        errorMessage: null,
        jobReferences: toJsonValue(result),
      },
    });

    logIntegration({
      service: "walrus",
      operation: "sync_call_memories",
      ok: true,
      message: "Call experiences persisted to Walrus Memory",
      durationMs: Date.now() - startedAt,
      meta: {
        dealId: sync.dealId,
        callId,
        namespace,
        total: result.total,
      },
    });

    await recordSyncTimeline({
      dealId: sync.dealId,
      callId,
      callNumber: sync.call.callNumber,
      eventType: "MEMORY_SYNCED",
      description: `Call ${sync.call.callNumber} memories persisted to Walrus (${result.succeeded}/${result.total})`,
      metadata: {
        namespace,
        attempts: updating.attempts,
        total: result.total,
        succeeded: result.succeeded,
        failed: result.failed,
      },
    });

    return {
      status: "COMPLETED",
      attempts: updating.attempts,
    };
  } catch (error) {
    const safe = toSafeError(error);
    await prisma.memorySync.update({
      where: { callId },
      data: {
        status: "FAILED",
        errorMessage: safe.message.slice(0, 2_000),
      },
    });

    logIntegration({
      service: "walrus",
      operation: "sync_call_memories",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
      meta: { dealId: sync.dealId, callId, namespace },
    });

    await recordSyncTimeline({
      dealId: sync.dealId,
      callId,
      callNumber: sync.call.callNumber,
      eventType: "MEMORY_SYNC_FAILED",
      description: safe.message,
      metadata: {
        namespace,
        attempts: updating.attempts,
        code: safe.code,
      },
    });

    return {
      status: "FAILED",
      errorMessage: safe.message,
      attempts: updating.attempts,
    };
  } finally {
    client?.destroy();
  }
}

/**
 * Retry a failed Walrus sync. Completed writes are never re-submitted, and the
 * memory text contains stable deal/call IDs so retries remain attributable.
 */
export async function retryMemorySync(
  callId: string,
): Promise<MemorySyncResult | null> {
  return syncCallMemories(callId);
}

async function getDealMemoryBlobIds(dealId: string): Promise<Set<string>> {
  const syncs = await prisma.memorySync.findMany({
    where: { dealId },
    select: { jobReferences: true },
  });

  const blobIds = new Set<string>();
  for (const sync of syncs) {
    const references = sync.jobReferences;
    if (
      !references ||
      typeof references !== "object" ||
      Array.isArray(references)
    ) {
      continue;
    }

    const results = (references as { results?: unknown }).results;
    if (!Array.isArray(results)) continue;

    for (const item of results) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { blob_id?: unknown }).blob_id === "string"
      ) {
        blobIds.add((item as { blob_id: string }).blob_id);
      }
    }
  }
  return blobIds;
}

export async function recallDealMemories(
  dealId: string,
  query: string,
  limit = 10,
): Promise<RecallResponse> {
  const namespace = MEMORY_NAMESPACES.deals;
  let client: MemWal | null = null;

  try {
    const dealBlobIds = await getDealMemoryBlobIds(dealId);
    client = createMemoryClient(namespace);

    // Over-fetch because the relayer index is shared across deals; the final
    // result is restricted to blobs that MemorySync recorded for this deal.
    const recallLimit = Math.min(Math.max(limit * 5, 50), 100);
    const result = await client.recall({
      query: buildMemoryRecallQuery(dealId, query),
      limit: recallLimit,
      namespace,
    });

    const results = result.results
      .filter(
        (memory) =>
          dealBlobIds.has(memory.blob_id) || memory.text.includes(dealId),
      )
      .slice(0, limit)
      .map((memory) => ({
        blobId: memory.blob_id,
        text: memory.text,
        distance: memory.distance,
        createdAt: memory.created_at,
      }));

    logIntegration({
      service: "walrus",
      operation: "recall_deal_memories",
      ok: true,
      message: "Recalled deal-scoped Walrus memories",
      meta: {
        dealId,
        namespace,
        matched: results.length,
        knownDealBlobs: dealBlobIds.size,
      },
    });

    return { dealId, namespace, query, results };
  } finally {
    client?.destroy();
  }
}
