import type {
  AnalysisStatus,
  DealStage,
  DealStatus,
  FactCategory,
  MemorySyncStatus,
} from "@/types/deal";

export const MEMORY_RELATIONSHIP_TYPES = [
  "BELONGS_TO",
  "DISCOVERED_IN",
  "RELATED_TO",
  "ADDRESSES",
  "UPDATED_BY",
  "INFLUENCED",
  "CONFIRMS",
  "CONTRADICTS",
] as const;

export const RELATIONSHIP_ORIGINS = ["EXPLICIT", "INFERRED"] as const;

export const MEMORY_LEARNING_ACTIONS = [
  "CREATED",
  "CONFIRMED",
  "REFINED",
  "CONTRADICTED",
] as const;

export const TIMELINE_EVENT_TYPES = [
  "CALL_ANALYZED",
  "MEMORY_CREATED",
  "MEMORY_CONFIRMED",
  "MEMORY_REFINED",
  "MEMORY_CONTRADICTED",
  "TECHNIQUE_ADDED",
  "RECOMMENDATION_GENERATED",
  "MEMORY_SYNCED",
  "MEMORY_SYNC_FAILED",
] as const;

export const RECOMMENDATION_STATUSES = [
  "SUGGESTED",
  "ACCEPTED",
  "MODIFIED",
  "DISMISSED",
  "EXECUTED",
  "OUTCOME_PENDING",
  "OUTCOME_RECORDED",
] as const;

export type MemoryRelationshipType =
  (typeof MEMORY_RELATIONSHIP_TYPES)[number];
export type RelationshipOrigin = (typeof RELATIONSHIP_ORIGINS)[number];
export type MemoryLearningAction = (typeof MEMORY_LEARNING_ACTIONS)[number];
export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export type GraphNodeType =
  | "deal"
  | "call"
  | "memory"
  | "technique"
  | "recommendation";

export interface MemoryExplorerSummary {
  totalCalls: number;
  totalMemories: number;
  totalCreated: number;
  totalConfirmed: number;
  totalRefined: number;
  totalContradicted: number;
  totalRecommendations: number;
  totalTechniques: number;
  memorySync: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
}

export interface DealNodeData {
  label: string;
  subtitle: string;
  stage: DealStage;
  status: DealStatus;
}

export interface CallNodeData {
  label: string;
  subtitle: string;
  callNumber: number;
  callDate: string | null;
  analysisStatus: AnalysisStatus;
  memorySyncStatus: MemorySyncStatus | null;
}

export interface MemoryNodeData {
  label: string;
  subtitle: string;
  category: FactCategory;
  content: string;
  evidence: string | null;
  confidence: number | null;
  isInferred: boolean;
  callId: string;
  callNumber: number;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TechniqueNodeData {
  label: string;
  subtitle: string;
  source: string | null;
  memoryId: string | null;
  createdAt: string;
}

export interface RecommendationNodeData {
  label: string;
  subtitle: string;
  status: RecommendationStatus;
  createdAt: string;
}

export type MemoryGraphNodeData =
  | DealNodeData
  | CallNodeData
  | MemoryNodeData
  | TechniqueNodeData
  | RecommendationNodeData;

export interface MemoryGraphNode {
  id: string;
  type: GraphNodeType;
  data: MemoryGraphNodeData;
}

export interface MemoryGraphEdge {
  id: string;
  source: string;
  target: string;
  type: MemoryRelationshipType;
  origin: RelationshipOrigin;
  label: string;
  explanation: string | null;
  createdAt: string | null;
}

export interface TimelineCallRef {
  id: string;
  callNumber: number;
  title: string | null;
}

export interface TimelineMemoryRef {
  id: string;
  category: FactCategory;
  content: string;
}

export interface TimelineEventView {
  id: string;
  eventType: TimelineEventType;
  title: string;
  description: string | null;
  createdAt: string;
  sourceCall: TimelineCallRef | null;
  sourceMemory: TimelineMemoryRef | null;
  recommendationId: string | null;
  metadata: Record<string, unknown> | null;
  syncStatus: MemorySyncStatus | null;
  relatedNodeIds: string[];
}

export interface MemoryExplorerDeal {
  id: string;
  customerName: string;
  productName: string;
  description: string | null;
  stage: DealStage;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryExplorerData {
  deal: MemoryExplorerDeal;
  summary: MemoryExplorerSummary;
  graph: {
    nodes: MemoryGraphNode[];
    edges: MemoryGraphEdge[];
  };
  timeline: TimelineEventView[];
  hasProcessing: boolean;
}

export interface MemoryVersionView {
  id: string;
  versionNumber: number;
  content: string;
  evidence: string | null;
  memoryType: FactCategory;
  confidence: number | null;
  sourceCall: TimelineCallRef | null;
  changeReason: string | null;
  createdAt: string;
}

export interface RelatedMemoryView {
  id: string;
  category: FactCategory;
  content: string;
  relationshipType: MemoryRelationshipType;
  direction: "outgoing" | "incoming";
  origin: RelationshipOrigin;
  explanation: string | null;
  createdAt: string;
}

export interface MemoryLearningEventView {
  id: string;
  action: MemoryLearningAction;
  reason: string | null;
  createdAt: string;
  sourceCall: TimelineCallRef | null;
  previousVersion: MemoryVersionView | null;
  newVersion: MemoryVersionView | null;
}

export interface MemoryRecommendationRef {
  id: string;
  content: string;
  status: RecommendationStatus;
  contribution: string | null;
  createdAt: string;
}

export interface MemoryTechniqueRef {
  id: string;
  name: string;
  description: string;
  source: string | null;
  createdAt: string;
}

export interface MemoryDetail {
  id: string;
  dealId: string;
  category: FactCategory;
  content: string;
  evidence: string | null;
  confidence: number | null;
  isInferred: boolean;
  createdAt: string;
  updatedAt: string;
  sourceCall: TimelineCallRef | null;
  versions: MemoryVersionView[];
  previousVersion: MemoryVersionView | null;
  relatedMemories: RelatedMemoryView[];
  learningEvents: MemoryLearningEventView[];
  recommendations: MemoryRecommendationRef[];
  techniques: MemoryTechniqueRef[];
}

export interface RecommendationMemoryView {
  id: string;
  category: FactCategory;
  content: string;
  evidence: string | null;
  confidence: number | null;
  contribution: string | null;
}

export interface RecommendationDetail {
  id: string;
  dealId: string;
  callId: string | null;
  content: string;
  reasoning: string | null;
  status: RecommendationStatus;
  createdAt: string;
  uncertainty: string | null;
  nextStep: string | null;
  confidence: number | null;
  organizationalEvidence: string | null;
  call: TimelineCallRef | null;
  caseContext: {
    id: string;
    categoryCode: string;
    categoryName: string;
    subtype: string;
    description: string;
  } | null;
  playbook: {
    id: string;
    versionId: string;
    title: string;
    strategyName: string | null;
    status: string;
  } | null;
  memories: RecommendationMemoryView[];
  techniques: MemoryTechniqueRef[];
}

export interface TechniqueView {
  id: string;
  organizationId: string | null;
  dealId: string | null;
  memoryId: string | null;
  name: string;
  description: string;
  source: string | null;
  createdAt: string;
  walrusStatus?: MemorySyncStatus | null;
  walrusSyncedAt?: string | null;
  walrusError?: string | null;
}
