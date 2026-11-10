import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createDeal } from "@/services/deal.service";
import {
  createCall,
  getCallById,
  processCallAnalysis,
} from "@/services/call.service";
import { recallDealMemories } from "@/services/memory.service";
import {
  getMemoryDetail,
  getMemoryExplorer,
  getRecommendationDetail,
} from "@/services/memory-explorer.service";
import { createTechnique } from "@/services/technique.service";

const enabled = process.env.RUN_PHASE2_INTEGRATION === "1";
const createdDealIds: string[] = [];

afterAll(async () => {
  if (createdDealIds.length > 0) {
    await prisma.deal.deleteMany({ where: { id: { in: createdDealIds } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!enabled)("Phase 2 end-to-end acceptance", () => {
  it(
    "creates two calls, persists facts and Walrus memories, then recalls them",
    async () => {
      const deal = await createDeal({
        customerName: "ABC Fitness",
        productName: "Gym Management Software",
        description: "Synthetic phase 2 acceptance deal.",
        stage: "DISCOVERY",
        status: "ACTIVE",
      });
      createdDealIds.push(deal.id);
      console.info("[phase2] deal created", deal.id);

      const first = await createCall(deal.id, {
        transcript:
          "The gym owner already uses another management system. They explained that payment follow-ups are mostly manual and that staff spend time contacting customers about overdue memberships. They are interested in understanding whether our product can automate this process.",
        title: "Discovery call",
        callDate: new Date("2026-11-01"),
      });
      expect(first).not.toBeNull();
      console.info("[phase2] call 1 saved, starting analysis + Walrus sync");
      await processCallAnalysis(first!.id);

      const firstCall = await getCallById(first!.id);
      expect(firstCall?.analysisStatus).toBe("COMPLETED");
      expect(firstCall?.summary).toBeTruthy();
      expect(firstCall!.facts.length).toBeGreaterThan(0);
      expect(firstCall?.memorySync?.status).toBe("COMPLETED");
      console.info(
        "[phase2] call 1 complete",
        `${firstCall!.facts.length} facts`,
        firstCall?.memorySync?.status,
      );

      const second = await createCall(deal.id, {
        transcript:
          "On the follow-up call the gym owner said they want a product demo next week. Budget approval comes from the operations director. They remain concerned that switching from their current software could disrupt daily operations, but they confirmed automated payment reminders are a requirement.",
        title: "Follow-up call",
        callDate: new Date("2026-11-05"),
      });
      expect(second?.callNumber).toBe(2);
      console.info("[phase2] call 2 saved, starting analysis + Walrus sync");
      await processCallAnalysis(second!.id);

      const secondCall = await getCallById(second!.id);
      expect(secondCall?.analysisStatus).toBe("COMPLETED");
      expect(secondCall?.memorySync?.status).toBe("COMPLETED");
      console.info(
        "[phase2] call 2 complete",
        `${secondCall!.facts.length} facts`,
        secondCall?.memorySync?.status,
      );

      const workspaceCalls = await prisma.call.findMany({
        where: { dealId: deal.id },
        orderBy: { callNumber: "asc" },
      });
      expect(workspaceCalls).toHaveLength(2);
      console.info("[phase2] both calls preserved for the same deal");
      expect(workspaceCalls[0].id).toBe(first!.id);

      let recalled = await recallDealMemories(
        deal.id,
        "What are the customer's pain points, objections, and requirements?",
        50,
      );
      for (let attempt = 0; attempt < 4 && recalled.results.length === 0; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        recalled = await recallDealMemories(
          deal.id,
          "What are the customer's pain points, objections, and requirements?",
          50,
        );
      }

      expect(recalled.results.length).toBeGreaterThan(0);
      console.info(
        "[phase2] recalled",
        recalled.results.length,
        "deal-scoped Walrus memories",
      );

      const syncs = await prisma.memorySync.findMany({
        where: { dealId: deal.id },
        select: { jobReferences: true },
      });
      const dealBlobIds = new Set<string>();
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
            dealBlobIds.add((item as { blob_id: string }).blob_id);
          }
        }
      }
      expect(dealBlobIds.size).toBeGreaterThan(0);
      expect(
        recalled.results.every(
          (memory) =>
            dealBlobIds.has(memory.blobId) || memory.text.includes(deal.id),
        ),
      ).toBe(true);

      const explorer = await getMemoryExplorer(deal.id);
      expect(explorer).not.toBeNull();
      expect(explorer!.summary.totalCalls).toBe(2);
      expect(explorer!.summary.totalMemories).toBeGreaterThan(0);
      expect(
        explorer!.graph.nodes.some((node) => node.type === "memory"),
      ).toBe(true);
      expect(
        explorer!.graph.edges.some((edge) => edge.type === "DISCOVERED_IN"),
      ).toBe(true);
      expect(
        explorer!.timeline.some((event) => event.eventType === "CALL_ANALYZED"),
      ).toBe(true);
      expect(
        explorer!.timeline.some((event) => event.eventType === "MEMORY_SYNCED"),
      ).toBe(true);

      const memoryNode = explorer!.graph.nodes.find(
        (node) => node.type === "memory",
      )!;
      const detail = await getMemoryDetail(
        deal.id,
        memoryNode.id.split(":")[1],
      );
      expect(detail).not.toBeNull();
      expect(detail!.versions.length).toBeGreaterThan(0);

      expect(explorer!.summary.totalRecommendations).toBeGreaterThan(0);
      const recommendationNode = explorer!.graph.nodes.find(
        (node) => node.type === "recommendation",
      );
      expect(recommendationNode).toBeDefined();
      expect(
        explorer!.graph.edges.some((edge) => edge.type === "INFLUENCED"),
      ).toBe(true);
      const recommendation = await getRecommendationDetail(
        deal.id,
        recommendationNode!.id.split(":")[1],
      );
      expect(recommendation).not.toBeNull();
      expect(recommendation!.memories.length).toBeGreaterThan(0);

      const technique = await createTechnique(deal.id, {
        name: "Synthetic ROI-first discovery",
        description:
          "Quantify the operational cost before responding to a price concern.",
        source: "Phase 2 acceptance test",
        memoryId: memoryNode.id.split(":")[1],
      });
      expect(technique).not.toBeNull();

      const withTechnique = await getMemoryExplorer(deal.id);
      expect(
        withTechnique!.graph.nodes.some((node) => node.type === "technique"),
      ).toBe(true);
      expect(
        withTechnique!.graph.edges.some((edge) => edge.type === "ADDRESSES"),
      ).toBe(true);
      expect(
        withTechnique!.timeline.some(
          (event) => event.eventType === "TECHNIQUE_ADDED",
        ),
      ).toBe(true);

      console.info(
        "[phase2] memory explorer",
        `${explorer!.summary.totalMemories} memories`,
        `${explorer!.timeline.length} timeline events`,
        `${detail!.versions.length} versions`,
        `${explorer!.summary.totalRecommendations} recommendations`,
      );
    },
    600_000,
  );
});
