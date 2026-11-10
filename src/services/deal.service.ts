import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  serializeCallTimeline,
  serializeFact,
  toDealStage,
  toDealStatus,
} from "@/lib/serializers";
import type { CreateDealInput, UpdateDealInput } from "@/lib/validation";
import type { DealListItem, DealWorkspace } from "@/types/deal";

export async function listDeals(): Promise<DealListItem[]> {
  const deals = await prisma.deal.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { calls: true } },
      calls: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return deals.map((deal) => ({
    id: deal.id,
    customerName: deal.customerName,
    productName: deal.productName,
    description: deal.description,
    stage: toDealStage(deal.stage),
    status: toDealStatus(deal.status),
    isSynthetic: deal.isSynthetic,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    callCount: deal._count.calls,
    lastActivityAt: (
      deal.calls[0]?.createdAt ?? deal.updatedAt
    ).toISOString(),
  }));
}

export async function createDeal(
  input: CreateDealInput,
): Promise<DealListItem> {
  const deal = await prisma.deal.create({
    data: {
      customerName: input.customerName,
      productName: input.productName,
      description: input.description ?? null,
      stage: input.stage,
      status: input.status,
    },
  });

  return {
    id: deal.id,
    customerName: deal.customerName,
    productName: deal.productName,
    description: deal.description,
    stage: toDealStage(deal.stage),
    status: toDealStatus(deal.status),
    isSynthetic: deal.isSynthetic,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    callCount: 0,
    lastActivityAt: deal.updatedAt.toISOString(),
  };
}

export async function getDealWorkspace(
  dealId: string,
): Promise<DealWorkspace | null> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      calls: {
        orderBy: { callNumber: "desc" },
        include: { memorySync: true },
      },
      facts: {
        orderBy: { createdAt: "desc" },
        include: { call: { select: { callNumber: true } } },
      },
    },
  });

  if (!deal) return null;

  const calls = deal.calls.map(serializeCallTimeline);
  const total = calls.filter((call) => call.memorySync !== null).length;
  const completed = calls.filter(
    (call) => call.memorySync?.status === "COMPLETED",
  ).length;
  const failed = calls.filter(
    (call) => call.memorySync?.status === "FAILED",
  ).length;

  return {
    id: deal.id,
    customerName: deal.customerName,
    productName: deal.productName,
    description: deal.description,
    stage: toDealStage(deal.stage),
    status: toDealStatus(deal.status),
    isSynthetic: deal.isSynthetic,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    calls,
    facts: deal.facts.map(serializeFact),
    memorySummary: {
      total,
      completed,
      failed,
      pending: Math.max(total - completed - failed, 0),
    },
  };
}

export async function updateDeal(
  dealId: string,
  input: UpdateDealInput,
): Promise<DealListItem | null> {
  const data: Prisma.DealUpdateInput = {};
  if (input.customerName !== undefined) data.customerName = input.customerName;
  if (input.productName !== undefined) data.productName = input.productName;
  if (input.description !== undefined) data.description = input.description;
  if (input.stage !== undefined) data.stage = input.stage;
  if (input.status !== undefined) data.status = input.status;

  try {
    const deal = await prisma.deal.update({
      where: { id: dealId },
      data,
      include: {
        _count: { select: { calls: true } },
        calls: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return {
      id: deal.id,
      customerName: deal.customerName,
      productName: deal.productName,
      description: deal.description,
      stage: toDealStage(deal.stage),
      status: toDealStatus(deal.status),
      isSynthetic: deal.isSynthetic,
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
      callCount: deal._count.calls,
      lastActivityAt: (
        deal.calls[0]?.createdAt ?? deal.updatedAt
      ).toISOString(),
    };
  } catch (error) {
    if ((error as { code?: string }).code === "P2025") {
      return null;
    }
    throw error;
  }
}

export async function dealExists(dealId: string): Promise<boolean> {
  const count = await prisma.deal.count({ where: { id: dealId } });
  return count > 0;
}
