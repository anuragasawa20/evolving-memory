import type {
  DEAL_STAGES,
  DEAL_STATUSES,
  FACT_CATEGORIES,
} from "@/lib/validation";

export type DealStage = (typeof DEAL_STAGES)[number];
export type DealStatus = (typeof DEAL_STATUSES)[number];
export type FactCategory = (typeof FACT_CATEGORIES)[number];
export type AnalysisStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type MemorySyncStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface MemorySyncView {
  id: string;
  status: MemorySyncStatus;
  namespace: string;
  attempts: number;
  errorMessage: string | null;
  syncedAt: string | null;
  jobReferences: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface DealListItem {
  id: string;
  customerName: string;
  productName: string;
  description: string | null;
  stage: DealStage;
  status: DealStatus;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
  callCount: number;
  lastActivityAt: string;
}

export interface FactView {
  id: string;
  callId: string;
  callNumber: number;
  category: FactCategory;
  content: string;
  evidence: string | null;
  confidence: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CallTimelineItem {
  id: string;
  callNumber: number;
  title: string | null;
  callDate: string | null;
  createdAt: string;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  summary: string | null;
  memorySync: MemorySyncView | null;
}

export interface DealWorkspace {
  id: string;
  customerName: string;
  productName: string;
  description: string | null;
  stage: DealStage;
  status: DealStatus;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
  calls: CallTimelineItem[];
  facts: FactView[];
  memorySummary: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
}

export interface CallDetail {
  id: string;
  dealId: string;
  callNumber: number;
  title: string | null;
  callDate: string | null;
  createdAt: string;
  summary: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  suggestedStage: DealStage | null;
  stageReasoning: string | null;
  deal: {
    id: string;
    customerName: string;
    productName: string;
    stage: DealStage;
    status: DealStatus;
  };
  facts: FactView[];
  memorySync: MemorySyncView | null;
}

export interface RecalledMemory {
  blobId: string;
  text: string;
  distance: number;
  createdAt?: string;
}

export interface RecallResponse {
  dealId: string;
  namespace: string;
  query: string;
  results: RecalledMemory[];
}
