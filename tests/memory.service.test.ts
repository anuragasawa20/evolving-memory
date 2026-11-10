import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    memorySync: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    memoryVersion: {
      findMany: vi.fn(),
    },
    timelineEvent: {
      create: vi.fn(),
    },
  },
  createMemoryClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/memory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/memory")>();
  return { ...actual, createMemoryClient: mocks.createMemoryClient };
});
vi.mock("@/lib/logger", () => ({ logIntegration: vi.fn() }));

import {
  recallDealMemories,
  retryMemorySync,
  syncCallMemories,
} from "@/services/memory.service";

const dealId = "11111111-1111-4111-8111-111111111111";
const callId = "22222222-2222-4222-8222-222222222222";

function syncFixture(status = "PENDING") {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    callId,
    dealId,
    namespace: "dealos_demo_deals",
    status,
    attempts: 0,
    jobReferences: null,
    errorMessage: null,
    syncedAt: null,
    createdAt: new Date("2026-11-01T10:00:00Z"),
    updatedAt: new Date("2026-11-01T10:00:00Z"),
    call: {
      id: callId,
      callNumber: 2,
      title: "Discovery call",
      callDate: new Date("2026-11-01T09:00:00Z"),
      createdAt: new Date("2026-11-01T09:30:00Z"),
      summary: "The owner manually follows up on overdue payments.",
      deal: {
        customerName: "ABC Fitness",
        productName: "Gym Management Software",
      },
      facts: [
        {
          category: "PAIN_POINT",
          content: "Manual payment follow-ups consume staff time.",
          evidence: "Staff members manually contact customers.",
          metadata: null,
          createdAt: new Date("2026-11-01T09:40:00Z"),
        },
        {
          category: "OBJECTION",
          content: "Switching systems could disrupt operations.",
          evidence: null,
          metadata: { severity: "HIGH" },
          createdAt: new Date("2026-11-01T09:41:00Z"),
        },
      ],
    },
  };
}

function fakeClient(overrides?: {
  analyzeAndWait?: ReturnType<typeof vi.fn>;
  recall?: ReturnType<typeof vi.fn>;
}) {
  return {
    analyzeAndWait: overrides?.analyzeAndWait ?? vi.fn(),
    recall: overrides?.recall ?? vi.fn(),
    destroy: vi.fn(),
  };
}

describe("Walrus memory persistence", () => {
  beforeEach(() => {
    mocks.prisma.memorySync.findUnique.mockResolvedValue(syncFixture());
    mocks.prisma.memorySync.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...syncFixture(),
        ...data,
        attempts: 1,
      }),
    );
    mocks.prisma.memoryVersion.findMany.mockResolvedValue([]);
    mocks.prisma.timelineEvent.create.mockResolvedValue({});
  });

  it("marks MemorySync COMPLETED only after analyzeAndWait confirms all facts", async () => {
    const analyzeAndWait = vi.fn().mockResolvedValue({
      total: 2,
      succeeded: 2,
      failed: 0,
      results: [
        { id: "job-1", status: "done", blob_id: "blob-1" },
        { id: "job-2", status: "done", blob_id: "blob-2" },
      ],
      facts: [],
      job_ids: ["job-1", "job-2"],
      owner: "owner-1",
    });
    const client = fakeClient({ analyzeAndWait });
    mocks.createMemoryClient.mockReturnValue(client);

    const result = await syncCallMemories(callId);

    expect(result?.status).toBe("COMPLETED");
    expect(analyzeAndWait).toHaveBeenCalledTimes(1);

    const memoryText = analyzeAndWait.mock.calls[0][0] as string;
    expect(memoryText).toContain(`Deal ID: ${dealId}`);
    expect(memoryText).toContain(`Call ID: ${callId}`);
    expect(memoryText).toContain("Manual payment follow-ups");
    expect(memoryText).toContain("Evidence: Staff members manually contact");

    const statuses = mocks.prisma.memorySync.update.mock.calls.map(
      ([arg]) => arg.data.status,
    );
    expect(statuses).toEqual(["PROCESSING", "COMPLETED"]);
    expect(client.destroy).toHaveBeenCalled();
  });

  it("syncs confirmations and refinements recorded as memory versions", async () => {
    mocks.prisma.memoryVersion.findMany.mockResolvedValue([
      {
        id: "version-1",
        memoryId: "memory-1",
        versionNumber: 2,
        content: "The owner now confirmed the migration concern.",
        evidence: "We are worried about migration.",
        memoryType: "OBJECTION",
        confidence: null,
        sourceCallId: callId,
        changeReason: "New evidence from call 2",
        createdAt: new Date("2026-11-02T10:00:00Z"),
      },
    ]);
    const analyzeAndWait = vi.fn().mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      results: [{ id: "job-1", status: "done", blob_id: "blob-1" }],
      facts: [],
      job_ids: ["job-1"],
      owner: "owner-1",
    });
    mocks.createMemoryClient.mockReturnValue(fakeClient({ analyzeAndWait }));

    const result = await syncCallMemories(callId);

    expect(result?.status).toBe("COMPLETED");
    const memoryText = analyzeAndWait.mock.calls[0][0] as string;
    expect(memoryText).toContain("The owner now confirmed the migration concern.");
    expect(memoryText).toContain("Evidence: We are worried about migration.");
    expect(mocks.prisma.timelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MEMORY_SYNCED",
          sourceCallId: callId,
        }),
      }),
    );
  });

  it("marks a failed Walrus call FAILED and never COMPLETED", async () => {
    const analyzeAndWait = vi
      .fn()
      .mockRejectedValue(new Error("relayer unavailable"));
    mocks.createMemoryClient.mockReturnValue(fakeClient({ analyzeAndWait }));

    const result = await syncCallMemories(callId);

    expect(result?.status).toBe("FAILED");
    const updates = mocks.prisma.memorySync.update.mock.calls.map(
      ([arg]) => arg.data,
    );
    expect(updates[0].status).toBe("PROCESSING");
    expect(updates.at(-1)).toMatchObject({
      status: "FAILED",
      errorMessage: expect.stringContaining("relayer unavailable"),
    });
    expect(updates.some((data) => data.status === "COMPLETED")).toBe(false);
    expect(mocks.prisma.timelineEvent.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MEMORY_SYNC_FAILED",
          sourceCallId: callId,
        }),
      }),
    );
  });

  it("treats a partial Walrus write as FAILED", async () => {
    mocks.createMemoryClient.mockReturnValue(
      fakeClient({
        analyzeAndWait: vi.fn().mockResolvedValue({
          total: 2,
          succeeded: 1,
          failed: 1,
          results: [{ id: "job-1", status: "failed" }],
          facts: [],
          job_ids: ["job-1"],
          owner: "owner-1",
        }),
      }),
    );

    const result = await syncCallMemories(callId);
    expect(result?.status).toBe("FAILED");
    expect(mocks.prisma.memorySync.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("1/2"),
        }),
      }),
    );
  });

  it("does not resubmit an already completed sync", async () => {
    mocks.prisma.memorySync.findUnique.mockResolvedValue(
      syncFixture("COMPLETED"),
    );

    const result = await retryMemorySync(callId);

    expect(result?.status).toBe("COMPLETED");
    expect(mocks.createMemoryClient).not.toHaveBeenCalled();
    expect(mocks.prisma.memorySync.update).not.toHaveBeenCalled();
  });

  it("retries a failed sync using the same stable call and deal identifiers", async () => {
    mocks.prisma.memorySync.findUnique.mockResolvedValue(
      syncFixture("FAILED"),
    );
    const analyzeAndWait = vi.fn().mockResolvedValue({
      total: 1,
      succeeded: 1,
      failed: 0,
      results: [{ id: "job-1", status: "done", blob_id: "blob-1" }],
      facts: [],
      job_ids: ["job-1"],
      owner: "owner-1",
    });
    mocks.createMemoryClient.mockReturnValue(fakeClient({ analyzeAndWait }));

    const result = await retryMemorySync(callId);

    expect(result?.status).toBe("COMPLETED");
    expect(analyzeAndWait.mock.calls[0][0]).toContain(`Call ID: ${callId}`);
    expect(mocks.prisma.memorySync.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
  });
});

describe("deal-scoped memory recall", () => {
  it("uses MemorySync blob references to scope recall to the deal", async () => {
    mocks.prisma.memorySync.findMany.mockResolvedValue([
      { jobReferences: { results: [{ blob_id: "blob-a" }] } },
      { jobReferences: { results: [{ blob_id: "blob-c" }] } },
    ]);
    const recall = vi.fn().mockResolvedValue({
      results: [
        {
          blob_id: "blob-a",
          text: "Customer pain point: manual follow-ups",
          distance: 0.12,
          created_at: "2026-11-01T10:00:00Z",
        },
        {
          blob_id: "blob-b",
          text: "Deal ID: other-deal\nUnrelated memory",
          distance: 0.2,
        },
        {
          blob_id: "blob-d",
          text: `Deal ID: ${dealId}\nLegacy memory without a blob reference`,
          distance: 0.25,
        },
      ],
    });
    const client = fakeClient({ recall });
    mocks.createMemoryClient.mockReturnValue(client);

    const result = await recallDealMemories(dealId, "objections?", 5);

    expect(mocks.prisma.memorySync.findMany).toHaveBeenCalledWith({
      where: { dealId },
      select: { jobReferences: true },
    });
    expect(recall).toHaveBeenCalledWith({
      query: expect.stringContaining(dealId),
      limit: 50,
      namespace: "dealos_demo_deals",
    });
    expect(result.results.map((memory) => memory.blobId)).toEqual([
      "blob-a",
      "blob-d",
    ]);
    expect(client.destroy).toHaveBeenCalled();
  });
});
