import type { Prisma } from "@prisma/client";
import type {
  CallTimelineItem,
  DealStage,
  DealStatus,
  FactCategory,
  FactView,
  MemorySyncStatus,
  MemorySyncView,
} from "@/types/deal";

interface MemorySyncRow {
  id: string;
  status: string;
  namespace: string;
  attempts: number;
  errorMessage: string | null;
  syncedAt: Date | null;
  jobReferences: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FactRow {
  id: string;
  callId: string;
  category: string;
  content: string;
  evidence: string | null;
  confidence: Prisma.Decimal | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  call?: { callNumber: number };
  callNumber?: number;
}

interface CallTimelineRow {
  id: string;
  callNumber: number;
  title: string | null;
  callDate: Date | null;
  createdAt: Date;
  analysisStatus: string;
  analysisError: string | null;
  summary: string | null;
  memorySync: MemorySyncRow | null;
}

export function serializeMemorySync(
  sync: MemorySyncRow | null | undefined,
): MemorySyncView | null {
  if (!sync) return null;
  return {
    id: sync.id,
    status: sync.status as MemorySyncStatus,
    namespace: sync.namespace,
    attempts: sync.attempts,
    errorMessage: sync.errorMessage,
    syncedAt: sync.syncedAt?.toISOString() ?? null,
    jobReferences: sync.jobReferences,
    createdAt: sync.createdAt.toISOString(),
    updatedAt: sync.updatedAt.toISOString(),
  };
}

function toMetadata(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function serializeFact(fact: FactRow): FactView {
  return {
    id: fact.id,
    callId: fact.callId,
    callNumber: fact.callNumber ?? fact.call?.callNumber ?? 0,
    category: fact.category as FactCategory,
    content: fact.content,
    evidence: fact.evidence,
    confidence: fact.confidence ? Number(fact.confidence) : null,
    metadata: toMetadata(fact.metadata),
    createdAt: fact.createdAt.toISOString(),
  };
}

export function serializeCallTimeline(call: CallTimelineRow): CallTimelineItem {
  return {
    id: call.id,
    callNumber: call.callNumber,
    title: call.title,
    callDate: call.callDate?.toISOString() ?? null,
    createdAt: call.createdAt.toISOString(),
    analysisStatus: call.analysisStatus as CallTimelineItem["analysisStatus"],
    analysisError: call.analysisError,
    summary: call.summary,
    memorySync: serializeMemorySync(call.memorySync),
  };
}

export function toDealStage(value: string): DealStage {
  return value as DealStage;
}

export function toDealStatus(value: string): DealStatus {
  return value as DealStatus;
}
