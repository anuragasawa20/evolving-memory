import type { MemorySyncStatus } from "@/types/deal";

export interface CaseSubtypeView {
  subtype: string;
  label: string;
  count: number;
  positive: number;
  negative: number;
}

export interface CaseLibraryCategoryView {
  categoryCode: string;
  categoryName: string;
  description: string;
  totalCases: number;
  syntheticCases: number;
  lastObservedAt: string | null;
  subtypes: CaseSubtypeView[];
}

export interface StrategyEvidenceView {
  strategyId: string;
  name: string;
  type: string;
  typeLabel: string;
  executions: number;
  positive: number;
  negative: number;
  neutral: number;
  pending: number;
  confidence: number;
  contexts: string[];
  caseIds: string[];
  executionIds: string[];
  outcomeBreakdown: { outcomeType: string; label: string; count: number }[];
  isSynthetic: boolean;
  lastEvaluatedAt: string | null;
}

export interface PlaybookVersionView {
  id: string;
  version: number;
  guidance: string;
  conditions: string;
  exceptions: string;
  evidenceSummary: string;
  confidence: number | null;
  approvalStatus: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: { id: string; name: string } | null;
  recommendedStrategy: {
    id: string;
    name: string;
    typeLabel: string;
  } | null;
  evidenceCount: number;
}

export interface PlaybookView {
  id: string;
  title: string;
  description: string;
  status: string;
  currentVersion: number;
  isSynthetic: boolean;
  categoryCode: string;
  categoryName: string;
  subtype: string;
  updatedAt: string;
  versions: PlaybookVersionView[];
}

export interface LearningInsightView {
  id: string;
  title: string;
  description: string;
  evidenceCaseIds: string[];
  evidenceExecutionIds: string[];
  evidenceCount: number;
  confidence: number;
  isSynthetic: boolean;
}

export interface WalrusSyncEntryView {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  namespace: string;
  status: MemorySyncStatus;
  attempts: number;
  blobReferences: unknown;
  errorMessage: string | null;
  syncedAt: string | null;
  updatedAt: string;
}

export interface WalrusStatusView {
  statusCounts: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  entityCounts: { entityType: string; count: number }[];
  namespaceCounts: { namespace: string; count: number }[];
  mainnet: {
    walrusBlobBaseUrl: string;
    walrusExplorerUrl: string;
    suiObjectBaseUrl: string;
    suiAccountBaseUrl: string;
    memoryAccountId: string | null;
  };
  recent: WalrusSyncEntryView[];
}

export interface OrganizationIntelligenceView {
  organization: {
    id: string;
    name: string;
    slug: string;
    salespeople: { id: string; name: string; role: string }[];
  };
  taxonomy: {
    code: string;
    name: string;
    description: string;
    subtypes: { code: string; name: string }[];
  }[];
  totals: {
    cases: number;
    syntheticCases: number;
    strategyExecutions: number;
    outcomes: number;
    strategies: number;
    playbooks: number;
    activePlaybooks: number;
  };
  caseLibrary: CaseLibraryCategoryView[];
  strategies: StrategyEvidenceView[];
  playbooks: PlaybookView[];
  insights: LearningInsightView[];
  walrus: WalrusStatusView;
}

export interface StrategyExplorerCaseView {
  id: string;
  subtype: string;
  description: string;
  evidence: string | null;
  dealStage: string | null;
  severity: string | null;
  confidence: number | null;
  salespersonName: string | null;
  callNumber: number;
  isSynthetic: boolean;
  createdAt: string;
  strategies: string[];
  outcomes: string[];
}

export interface StrategyExplorerView {
  categoryCode: string;
  categoryName: string;
  subtype: string | null;
  totalCases: number;
  totalExecutions: number;
  totalOutcomes: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  pendingOutcomes: number;
  strategies: StrategyEvidenceView[];
  cases: StrategyExplorerCaseView[];
}

export interface WalrusRecallView {
  query: string;
  namespaces: string[];
  results: {
    blobId: string;
    text: string;
    distance: number;
    createdAt?: string;
    namespace: string;
    memoryType: string;
  }[];
}

export interface PersonalTechniqueView {
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
