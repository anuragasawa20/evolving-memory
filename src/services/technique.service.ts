import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDefaultOrganizationContext,
} from "@/services/organization.service";
import { syncPersonalTechniqueMemory } from "@/services/organization-memory.service";
import type { CreateTechniqueInput } from "@/lib/validation";
import type { TechniqueView } from "@/types/memory";

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function serializeTechnique(technique: {
  id: string;
  organizationId: string | null;
  dealId: string | null;
  memoryId: string | null;
  name: string;
  description: string;
  source: string | null;
  createdAt: Date;
}): TechniqueView {
  return {
    id: technique.id,
    organizationId: technique.organizationId,
    dealId: technique.dealId,
    memoryId: technique.memoryId,
    name: technique.name,
    description: technique.description,
    source: technique.source,
    createdAt: technique.createdAt.toISOString(),
  };
}

export async function listTechniques(dealId: string): Promise<TechniqueView[]> {
  const techniques = await prisma.personalTechnique.findMany({
    where: { OR: [{ dealId: null }, { dealId }] },
    orderBy: { createdAt: "asc" },
  });
  return techniques.map(serializeTechnique);
}

export async function listPersonalTechniques(
  organizationId: string,
): Promise<TechniqueView[]> {
  const [techniques, syncs] = await Promise.all([
    prisma.personalTechnique.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.organizationMemorySync.findMany({
      where: { organizationId, entityType: "PERSONAL_TECHNIQUE" },
    }),
  ]);

  const syncByEntity = new Map(syncs.map((sync) => [sync.entityId, sync]));

  return techniques.map((technique) => {
    const sync = syncByEntity.get(technique.id);
    return {
      ...serializeTechnique(technique),
      walrusStatus: sync?.status ?? null,
      walrusSyncedAt: sync?.syncedAt?.toISOString() ?? null,
      walrusError: sync?.errorMessage ?? null,
    };
  });
}

export async function createTechnique(
  dealId: string | null,
  input: CreateTechniqueInput,
  options?: { organizationId?: string },
): Promise<TechniqueView | null> {
  const organizationId =
    options?.organizationId ??
    (await getDefaultOrganizationContext()).organizationId;

  if (dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true },
    });
    if (!deal) return null;

    if (input.memoryId) {
      const memory = await prisma.extractedFact.findFirst({
        where: { id: input.memoryId, dealId },
        select: { id: true },
      });
      if (!memory) return null;
    }
  }

  const technique = await prisma.$transaction(async (tx) => {
    const created = await tx.personalTechnique.create({
      data: {
        organizationId,
        dealId,
        memoryId: dealId ? (input.memoryId ?? null) : null,
        name: input.name,
        description: input.description,
        source: input.source ?? null,
      },
    });

    if (dealId) {
      await tx.timelineEvent.create({
        data: {
          dealId,
          eventType: "TECHNIQUE_ADDED",
          title: "Personal technique added",
          description: `${created.name}: ${created.description}`,
          sourceMemoryId: created.memoryId,
          metadata: toJsonValue({
            techniqueId: created.id,
            name: created.name,
            source: created.source,
          }),
        },
      });
    }

    return created;
  });

  // Walrus learning memory is tracked independently from PostgreSQL.
  await syncPersonalTechniqueMemory(technique.id);

  return serializeTechnique(technique);
}

export async function retryPersonalTechniqueSync(techniqueId: string) {
  return syncPersonalTechniqueMemory(techniqueId);
}
