import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { persistReconciledMemories } from "@/services/memory-learning.service";
import type {
  NormalizedReconciliation,
  ReconciliationCandidate,
} from "@/lib/memory-reconciliation";

const dealId = "11111111-1111-4111-8111-111111111111";
const callId = "22222222-2222-4222-8222-222222222222";
const oldCallId = "33333333-3333-4333-8333-333333333333";
const memoryId = "44444444-4444-4444-8444-444444444444";

const candidate: ReconciliationCandidate = {
  category: "PAIN_POINT",
  content: "Manual payment follow-ups consume staff time.",
  evidence: "Staff call customers about overdue memberships.",
  isInferred: false,
};

function makeTx() {
  return {
    extractedFact: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    memoryVersion: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    memoryLearningEvent: { create: vi.fn() },
    memoryRelationship: { upsert: vi.fn() },
    timelineEvent: { create: vi.fn() },
  };
}

function input(decisions: NormalizedReconciliation[]) {
  return {
    dealId,
    callId,
    callNumber: 2,
    candidates: [candidate],
    decisions,
    startAt: new Date("2026-11-10T10:00:00Z"),
  };
}

describe("memory learning persistence", () => {
  it("creates a canonical memory, v1, a learning event and a timeline event", async () => {
    const tx = makeTx();
    tx.extractedFact.create.mockResolvedValue({
      id: memoryId,
      content: candidate.content,
      evidence: candidate.evidence,
      category: candidate.category,
      callId,
      dealId,
      confidence: null,
      isInferred: false,
    });
    tx.memoryVersion.create.mockResolvedValue({
      id: "version-1",
      versionNumber: 1,
    });
    tx.memoryLearningEvent.create.mockResolvedValue({});
    tx.timelineEvent.create.mockResolvedValue({});

    const result = await persistReconciledMemories(
      tx as unknown as Prisma.TransactionClient,
      input([
        {
          candidateIndex: 0,
          action: "CREATE",
          targetMemoryId: null,
          refinedContent: null,
          refinedEvidence: null,
          reason: "New knowledge.",
        },
      ]),
    );

    expect(result).toMatchObject({
      created: 1,
      confirmed: 0,
      refined: 0,
      contradicted: 0,
      memoryIds: [memoryId],
    });
    expect(tx.memoryVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionNumber: 1, memoryId }),
      }),
    );
    expect(tx.memoryLearningEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATED",
          newVersionId: "version-1",
        }),
      }),
    );
    expect(tx.timelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MEMORY_CREATED",
          sourceMemoryId: memoryId,
        }),
      }),
    );
  });

  it("appends a REFINE version and preserves the previous version id", async () => {
    const tx = makeTx();
    tx.extractedFact.findFirst.mockResolvedValue({
      id: memoryId,
      dealId,
      callId: oldCallId,
      category: "PAIN_POINT",
      content: "Old understanding.",
      evidence: "Old quote.",
      confidence: null,
    });
    tx.memoryVersion.findFirst.mockResolvedValue({
      id: "version-1",
      versionNumber: 1,
    });
    tx.memoryVersion.create.mockResolvedValue({
      id: "version-2",
      versionNumber: 2,
    });
    tx.extractedFact.update.mockResolvedValue({});
    tx.memoryLearningEvent.create.mockResolvedValue({});
    tx.timelineEvent.create.mockResolvedValue({});

    const result = await persistReconciledMemories(
      tx as unknown as Prisma.TransactionClient,
      input([
        {
          candidateIndex: 0,
          action: "REFINE",
          targetMemoryId: memoryId,
          refinedContent: "Refined understanding.",
          refinedEvidence: "New quote.",
          reason: "The second call sharpened the problem.",
        },
      ]),
    );

    expect(result).toMatchObject({ created: 0, refined: 1 });
    expect(tx.memoryVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versionNumber: 2,
          content: "Refined understanding.",
          evidence: "New quote.",
          sourceCallId: callId,
        }),
      }),
    );
    expect(tx.extractedFact.update).toHaveBeenCalledWith({
      where: { id: memoryId },
      data: expect.objectContaining({ content: "Refined understanding." }),
    });
    expect(tx.memoryLearningEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REFINED",
          previousVersionId: "version-1",
          newVersionId: "version-2",
        }),
      }),
    );
    expect(tx.timelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MEMORY_REFINED",
          sourceMemoryId: memoryId,
        }),
      }),
    );
  });

  it("confirms an existing memory with new evidence without changing its content", async () => {
    const tx = makeTx();
    tx.extractedFact.findFirst.mockResolvedValue({
      id: memoryId,
      dealId,
      callId: oldCallId,
      category: "PAIN_POINT",
      content: "Canonical content.",
      evidence: "Old quote.",
      confidence: null,
    });
    tx.memoryVersion.findFirst.mockResolvedValue({
      id: "version-1",
      versionNumber: 1,
    });
    tx.memoryVersion.create.mockResolvedValue({
      id: "version-2",
      versionNumber: 2,
    });
    tx.extractedFact.update.mockResolvedValue({});
    tx.memoryLearningEvent.create.mockResolvedValue({});
    tx.timelineEvent.create.mockResolvedValue({});

    const result = await persistReconciledMemories(
      tx as unknown as Prisma.TransactionClient,
      input([
        {
          candidateIndex: 0,
          action: "CONFIRM",
          targetMemoryId: memoryId,
          refinedContent: null,
          refinedEvidence: null,
          reason: "Call 2 repeated the same pain point.",
        },
      ]),
    );

    expect(result).toMatchObject({ confirmed: 1, created: 0 });
    expect(tx.memoryVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Canonical content.",
          evidence: candidate.evidence,
        }),
      }),
    );
    expect(tx.memoryLearningEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CONFIRMED",
          previousVersionId: "version-1",
          newVersionId: "version-2",
        }),
      }),
    );
  });

  it("preserves a contradicting statement as a new linked memory", async () => {
    const tx = makeTx();
    tx.extractedFact.findFirst.mockResolvedValue({
      id: memoryId,
      dealId,
      callId: oldCallId,
      category: "PAIN_POINT",
      content: "Old understanding.",
      evidence: "Old quote.",
      confidence: null,
    });
    tx.extractedFact.create.mockResolvedValue({
      id: "new-memory",
      content: candidate.content,
      evidence: candidate.evidence,
      category: candidate.category,
      callId,
      dealId,
      confidence: null,
      isInferred: false,
    });
    tx.memoryVersion.findFirst.mockResolvedValue({
      id: "version-1",
      versionNumber: 1,
    });
    tx.memoryVersion.create.mockResolvedValue({
      id: "version-new",
      versionNumber: 1,
    });
    tx.memoryRelationship.upsert.mockResolvedValue({});
    tx.memoryLearningEvent.create.mockResolvedValue({});
    tx.timelineEvent.create.mockResolvedValue({});

    const result = await persistReconciledMemories(
      tx as unknown as Prisma.TransactionClient,
      input([
        {
          candidateIndex: 0,
          action: "CONTRADICT",
          targetMemoryId: memoryId,
          refinedContent: null,
          refinedEvidence: null,
          reason: "The customer now says the process is automated.",
        },
      ]),
    );

    expect(result).toMatchObject({ created: 1, contradicted: 1 });
    expect(tx.memoryRelationship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceMemoryId: "new-memory",
          targetMemoryId: memoryId,
          relationshipType: "CONTRADICTS",
          origin: "EXPLICIT",
        }),
      }),
    );
    expect(tx.memoryLearningEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CONTRADICTED",
          memoryId,
          previousVersionId: "version-1",
        }),
      }),
    );
    expect(tx.timelineEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "MEMORY_CONTRADICTED",
          sourceMemoryId: memoryId,
        }),
      }),
    );
  });
});
