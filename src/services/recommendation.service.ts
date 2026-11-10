import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { getLlmClient, getLlmEnv } from "@/lib/llm";
import { toSafeError } from "@/lib/errors";
import { logIntegration } from "@/lib/logger";
import { withTimeout } from "@/lib/with-timeout";
import { prisma } from "@/lib/prisma";
import {
  buildRecommendationPrompt,
  parseRecommendation,
  RECOMMENDATION_SYSTEM_PROMPT,
  type RecommendationCaseInput,
  type RecommendationMemoryInput,
  type RecommendationOutput,
  type RecommendationPlaybookInput,
  type RecommendationTechniqueInput,
} from "@/lib/recommendation";
import { recallCombinedOrganizationMemory } from "@/services/organization-memory.service";
import type { FactCategory } from "@/types/deal";

const MAX_MEMORIES = 40;
const MAX_TECHNIQUES = 20;
const MAX_TOKENS = 2_048;
const TIMEOUT_MS = 120_000;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function requestRecommendation(
  prompt: string,
): Promise<{ content: string; model: string }> {
  const env = getLlmEnv();
  const client = getLlmClient();
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: RECOMMENDATION_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];

  const create = (jsonMode: boolean) =>
    client.chat.completions.create(
      {
        model: env.OPENROUTER_MODEL,
        temperature: 0,
        max_tokens: MAX_TOKENS,
        messages,
        ...(jsonMode
          ? { response_format: { type: "json_object" as const } }
          : {}),
      },
      {
        timeout: TIMEOUT_MS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await withTimeout(
      create(true),
      TIMEOUT_MS + 5_000,
      "Recommendation request timed out",
    );
  } catch (error) {
    const isFormatIssue =
      error instanceof OpenAI.APIError &&
      error.status === 400 &&
      /response_format|json|structured/i.test(error.message);
    if (!isFormatIssue) throw error;
    completion = await withTimeout(
      create(false),
      TIMEOUT_MS + 5_000,
      "Recommendation request timed out",
    );
  }

  return {
    content: completion.choices[0]?.message?.content ?? "",
    model: completion.model ?? env.OPENROUTER_MODEL,
  };
}

function normalizeRecommendation(
  output: RecommendationOutput,
  memoryIds: Set<string>,
  techniqueIds: Set<string>,
) {
  const seen = new Set<string>();
  const memories = output.influencingMemories.filter((memory) => {
    if (!memoryIds.has(memory.memoryId) || seen.has(memory.memoryId)) {
      return false;
    }
    seen.add(memory.memoryId);
    return true;
  });

  if (memories.length === 0) {
    return null;
  }

  return {
    memories,
    techniqueIds: Array.from(
      new Set(
        (output.relevantTechniqueIds ?? []).filter((id) => techniqueIds.has(id)),
      ),
    ),
  };
}

export interface GenerateRecommendationInput {
  dealId: string;
  callId: string;
  callNumber: number;
  summary: string;
}

/**
 * Generate a suggested next action grounded in the deal's remembered context.
 *
 * Suggestions are persisted separately from execution. A recommendation is
 * never marked accepted or executed by this function.
 */
export async function generateRecommendationForCall(
  input: GenerateRecommendationInput,
): Promise<string | null> {
  const startedAt = Date.now();

  const [deal, memories, techniques, caseInstance] = await Promise.all([
    prisma.deal.findUnique({
      where: { id: input.dealId },
      select: { customerName: true, productName: true, stage: true },
    }),
    prisma.extractedFact.findMany({
      where: { dealId: input.dealId },
      orderBy: { updatedAt: "desc" },
      take: MAX_MEMORIES,
      include: { call: { select: { callNumber: true } } },
    }),
    prisma.personalTechnique.findMany({
      where: { OR: [{ dealId: null }, { dealId: input.dealId }] },
      orderBy: { createdAt: "desc" },
      take: MAX_TECHNIQUES,
    }),
    prisma.caseInstance.findFirst({
      where: { callId: input.callId },
      orderBy: { confidence: "desc" },
      include: { category: true },
    }),
  ]);

  if (!deal || memories.length === 0) {
    return null;
  }

  let playbookInput: RecommendationPlaybookInput | null = null;
  let caseContext: RecommendationCaseInput | null = null;
  let semanticRecall: string[] = [];
  let recommendedStrategyId: string | null = null;

  if (caseInstance) {
    caseContext = {
      id: caseInstance.id,
      categoryCode: caseInstance.category.code,
      categoryName: caseInstance.category.name,
      subtype: caseInstance.subtype,
      description: caseInstance.description,
      evidence: caseInstance.evidence,
    };

    const playbook = await prisma.organizationalPlaybook.findFirst({
      where: {
        organizationId: caseInstance.organizationId,
        caseCategoryId: caseInstance.categoryId,
        subtype: caseInstance.subtype,
        status: { in: ["ACTIVE", "APPROVED"] },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: {
          where: { approvalStatus: "APPROVED" },
          orderBy: { version: "desc" },
          take: 1,
          include: {
            recommendedStrategy: true,
            _count: { select: { evidence: true } },
          },
        },
      },
    });

    const version = playbook?.versions[0];
    if (playbook && version) {
      playbookInput = {
        id: playbook.id,
        versionId: version.id,
        title: playbook.title,
        guidance: version.guidance,
        conditions: version.conditions,
        exceptions: version.exceptions,
        evidenceSummary: version.evidenceSummary,
        confidence: version.confidence ? Number(version.confidence) : null,
        strategyName: version.recommendedStrategy?.name ?? null,
        strategyId: version.recommendedStrategy?.id ?? null,
        evidenceCount: version._count.evidence,
      };
      recommendedStrategyId = version.recommendedStrategy?.id ?? null;
    }

    try {
      const recall = await recallCombinedOrganizationMemory(
        caseInstance.organizationId,
        `${caseInstance.category.name} ${caseInstance.subtype} ${caseInstance.description}`,
        6,
      );
      semanticRecall = recall.results.map((result) =>
        result.text.replace(/\s+/g, " ").slice(0, 500),
      );
    } catch (error) {
      const safe = toSafeError(error);
      logIntegration({
        service: "walrus",
        operation: "recall_for_recommendation",
        ok: false,
        message: safe.message,
        code: safe.code,
        meta: { dealId: input.dealId, callId: input.callId },
      });
    }
  }

  const memoryInputs: RecommendationMemoryInput[] = memories.map((memory) => ({
    id: memory.id,
    category: memory.category as FactCategory,
    content: memory.content,
    evidence: memory.evidence,
    confidence: memory.confidence ? Number(memory.confidence) : null,
    callNumber: memory.call.callNumber,
  }));

  const techniqueInputs: RecommendationTechniqueInput[] = techniques.map(
    (technique) => ({
      id: technique.id,
      name: technique.name,
      description: technique.description,
      source: technique.source,
      memoryId: technique.memoryId,
    }),
  );

  const prompt = buildRecommendationPrompt({
    customerName: deal.customerName,
    productName: deal.productName,
    stage: deal.stage,
    callNumber: input.callNumber,
    summary: input.summary,
    memories: memoryInputs,
    techniques: techniqueInputs,
    caseContext,
    playbook: playbookInput,
    organizationalRecall: semanticRecall,
  });

  const memoryIds = new Set(memoryInputs.map((memory) => memory.id));
  const techniqueIds = new Set(techniqueInputs.map((technique) => technique.id));

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await requestRecommendation(prompt);
      const output = parseRecommendation(result.content);
      const normalized = normalizeRecommendation(
        output,
        memoryIds,
        techniqueIds,
      );

      if (!normalized) {
        throw new Error(
          "Recommendation did not reference any valid influencing memory",
        );
      }

      if (!recommendedStrategyId && output.recommendedStrategyName && caseInstance) {
        const matched = await prisma.strategy.findFirst({
          where: {
            organizationId: caseInstance.organizationId,
            name: {
              equals: output.recommendedStrategyName,
              mode: "insensitive",
            },
          },
          select: { id: true },
        });
        recommendedStrategyId = matched?.id ?? null;
      }

      const now = new Date();
      const recommendation = await prisma.$transaction(async (tx) => {
        const created = await tx.recommendation.create({
          data: {
            dealId: input.dealId,
            callId: input.callId,
            content: output.action,
            reasoning: output.reasoning,
            status: "SUGGESTED",
            caseInstanceId: caseInstance?.id ?? null,
            playbookVersionId: playbookInput?.versionId ?? null,
            metadata: toJsonValue({
              uncertainty: output.uncertainty ?? null,
              nextStep: output.nextStep ?? null,
              confidence: output.confidence ?? null,
              techniqueIds: normalized.techniqueIds,
              organizationalEvidence: output.organizationalEvidence ?? null,
              recommendedStrategyName: output.recommendedStrategyName ?? null,
              recommendedStrategyId,
              caseCategory: caseContext?.categoryCode ?? null,
              caseSubtype: caseContext?.subtype ?? null,
              playbookId: playbookInput?.id ?? null,
              playbookVersionId: playbookInput?.versionId ?? null,
              semanticRecallCount: semanticRecall.length,
            }),
            createdAt: now,
          },
        });

        await tx.recommendationMemory.createMany({
          data: normalized.memories.map((memory) => ({
            recommendationId: created.id,
            memoryId: memory.memoryId,
            contribution: memory.contribution,
          })),
        });

        await tx.timelineEvent.create({
          data: {
            dealId: input.dealId,
            eventType: "RECOMMENDATION_GENERATED",
            title: "Recommendation generated",
            description: output.action,
            sourceCallId: input.callId,
            recommendationId: created.id,
            metadata: toJsonValue({
              callNumber: input.callNumber,
              confidence: output.confidence ?? null,
              techniqueIds: normalized.techniqueIds,
              memoryIds: normalized.memories.map((memory) => memory.memoryId),
            }),
            createdAt: new Date(now.getTime() + 1),
          },
        });

        return created;
      });

      logIntegration({
        service: "llm",
        operation: "generate_recommendation",
        ok: true,
        message: "Recommendation generated and linked to memories",
        durationMs: Date.now() - startedAt,
        meta: {
          dealId: input.dealId,
          callId: input.callId,
          model: result.model,
          attempt,
          memoryCount: normalized.memories.length,
        },
      });

      return recommendation.id;
    } catch (error) {
      lastError = error;
    }
  }

  const safe = toSafeError(lastError);
  logIntegration({
    service: "llm",
    operation: "generate_recommendation",
    ok: false,
    message: safe.message,
    code: safe.code,
    durationMs: Date.now() - startedAt,
    meta: { dealId: input.dealId, callId: input.callId },
  });

  return null;
}
