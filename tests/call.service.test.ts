import { beforeEach, describe, expect, it, vi } from "vitest";
import { validAnalysis } from "./fixtures";
import { IntegrationError } from "@/lib/errors";

const mocks = vi.hoisted(() => {
  const tx = {
    call: { create: vi.fn(), update: vi.fn() },
    deal: { update: vi.fn() },
    memorySync: { upsert: vi.fn() },
    timelineEvent: { create: vi.fn() },
  };

  return {
    tx,
    prisma: {
      deal: { findUnique: vi.fn() },
      call: {
        aggregate: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    analyzeTranscript: vi.fn(),
    syncCallMemories: vi.fn(),
    reconcileCallMemories: vi.fn(),
    persistReconciledMemories: vi.fn(),
    cleanupCallExplorerArtifacts: vi.fn(),
    generateRecommendationForCall: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/services/llm.service", () => ({
  analyzeTranscript: mocks.analyzeTranscript,
}));
vi.mock("@/services/memory.service", () => ({
  syncCallMemories: mocks.syncCallMemories,
}));
vi.mock("@/services/reconciliation.service", () => ({
  reconcileCallMemories: mocks.reconcileCallMemories,
}));
vi.mock("@/services/memory-learning.service", () => ({
  persistReconciledMemories: mocks.persistReconciledMemories,
  cleanupCallExplorerArtifacts: mocks.cleanupCallExplorerArtifacts,
}));
vi.mock("@/services/recommendation.service", () => ({
  generateRecommendationForCall: mocks.generateRecommendationForCall,
}));
vi.mock("@/lib/logger", () => ({ logIntegration: vi.fn() }));

import { createCall, processCallAnalysis } from "@/services/call.service";

const dealId = "11111111-1111-4111-8111-111111111111";
const callId = "22222222-2222-4222-8222-222222222222";

describe("createCall", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
    );
    mocks.prisma.deal.findUnique.mockResolvedValue({ id: dealId });
    mocks.prisma.call.aggregate.mockResolvedValue({
      _max: { callNumber: 2 },
    });
    mocks.tx.call.create.mockResolvedValue({
      id: callId,
      dealId,
      callNumber: 3,
      analysisStatus: "PENDING",
    });
    mocks.tx.deal.update.mockResolvedValue({});
  });

  it("checks the deal, assigns the next call number, and stores the transcript", async () => {
    const created = await createCall(dealId, {
      transcript:
        "The gym owner already uses another management system. Payment follow-ups are manual.",
      title: "Discovery call",
      callDate: new Date("2026-11-01"),
    });

    expect(created).toMatchObject({ id: callId, callNumber: 3 });
    expect(mocks.tx.call.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dealId,
        transcript: expect.stringContaining("follow-ups"),
        title: "Discovery call",
        callNumber: 3,
      }),
    });
  });

  it("returns null when the deal does not exist", async () => {
    mocks.prisma.deal.findUnique.mockResolvedValue(null);

    const created = await createCall(dealId, {
      transcript: "A long enough synthetic transcript for validation.",
    });

    expect(created).toBeNull();
    expect(mocks.tx.call.create).not.toHaveBeenCalled();
  });
});

describe("processCallAnalysis", () => {
  beforeEach(() => {
    mocks.prisma.call.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.call.findUnique.mockResolvedValue({
      id: callId,
      dealId,
      callNumber: 2,
      transcript: "Synthetic transcript for analysis.",
      deal: {
        id: dealId,
        customerName: "ABC Fitness",
        productName: "Gym Management Software",
      },
    });
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
    );
    mocks.tx.call.update.mockResolvedValue({});
    mocks.tx.memorySync.upsert.mockResolvedValue({});
    mocks.tx.timelineEvent.create.mockResolvedValue({});
    mocks.analyzeTranscript.mockResolvedValue(validAnalysis);
    mocks.reconcileCallMemories.mockResolvedValue([]);
    mocks.cleanupCallExplorerArtifacts.mockResolvedValue(undefined);
    mocks.persistReconciledMemories.mockResolvedValue({
      created: 7,
      confirmed: 0,
      refined: 0,
      contradicted: 0,
      memoryIds: ["memory-1"],
    });
    mocks.generateRecommendationForCall.mockResolvedValue("recommendation-1");
    mocks.syncCallMemories.mockResolvedValue({ status: "COMPLETED" });
  });

  it("reconciles facts, persists memory provenance, and records the call event", async () => {
    await processCallAnalysis(callId);

    expect(mocks.prisma.call.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ analysisStatus: "PROCESSING" }),
      }),
    );

    expect(mocks.reconcileCallMemories).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId,
        callId,
        callNumber: 2,
        summary: validAnalysis.summary,
      }),
    );
    expect(mocks.reconcileCallMemories.mock.calls[0][0].candidates.length).toBeGreaterThan(3);
    expect(
      mocks.reconcileCallMemories.mock.calls[0][0].candidates.some(
        (fact: { category: string; evidence: string | null }) =>
          fact.category === "PAIN_POINT" &&
          fact.evidence?.includes("payment follow-ups"),
      ),
    ).toBe(true);

    expect(mocks.cleanupCallExplorerArtifacts).toHaveBeenCalledWith(
      mocks.tx,
      callId,
    );
    expect(mocks.tx.call.update).toHaveBeenCalledWith({
      where: { id: callId },
      data: expect.objectContaining({
        summary: validAnalysis.summary,
        suggestedStage: "DISCOVERY",
        analysisStatus: "COMPLETED",
      }),
    });
    expect(mocks.persistReconciledMemories).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({
        dealId,
        callId,
        callNumber: 2,
        candidates: expect.any(Array),
        decisions: [],
      }),
    );
    expect(mocks.tx.memorySync.upsert).toHaveBeenCalled();
    expect(mocks.tx.timelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "CALL_ANALYZED",
          sourceCallId: callId,
          metadata: expect.objectContaining({ created: 7 }),
        }),
      }),
    );
    expect(mocks.generateRecommendationForCall).toHaveBeenCalledWith({
      dealId,
      callId,
      callNumber: 2,
      summary: validAnalysis.summary,
    });
    expect(mocks.syncCallMemories).toHaveBeenCalledWith(callId);
  });

  it("does not overwrite the current deal stage with the suggestion", async () => {
    await processCallAnalysis(callId);
    expect(mocks.tx.deal.update).not.toHaveBeenCalled();
  });

  it("marks the call failed and saves nothing when the LLM response is invalid", async () => {
    mocks.analyzeTranscript.mockRejectedValue(
      new IntegrationError(
        "INVALID_RESPONSE",
        "Model JSON failed analysis validation",
        "llm",
      ),
    );

    await processCallAnalysis(callId);

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.reconcileCallMemories).not.toHaveBeenCalled();
    expect(mocks.prisma.call.updateMany).toHaveBeenLastCalledWith({
      where: { id: callId, analysisStatus: "PROCESSING" },
      data: {
        analysisStatus: "FAILED",
        analysisError: "Model JSON failed analysis validation",
      },
    });
    expect(mocks.syncCallMemories).not.toHaveBeenCalled();
  });

  it("keeps PostgreSQL analysis success independent from a Walrus failure", async () => {
    mocks.syncCallMemories.mockResolvedValue({
      status: "FAILED",
      errorMessage: "Walrus unavailable",
    });

    await processCallAnalysis(callId);

    expect(mocks.tx.call.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ analysisStatus: "COMPLETED" }),
      }),
    );
  });
});
