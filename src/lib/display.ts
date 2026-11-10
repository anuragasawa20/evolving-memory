import type { Tone } from "@/components/ui/badge";
import type {
  AnalysisStatus,
  DealStage,
  DealStatus,
  FactCategory,
  MemorySyncStatus,
} from "@/types/deal";

export const STAGE_LABELS: Record<DealStage, string> = {
  DISCOVERY: "Discovery",
  QUALIFICATION: "Qualification",
  DEMO: "Demo",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSING: "Closing",
  WON: "Won",
  LOST: "Lost",
};

export const STAGE_TONES: Record<DealStage, Tone> = {
  DISCOVERY: "blue",
  QUALIFICATION: "blue",
  DEMO: "purple",
  PROPOSAL: "purple",
  NEGOTIATION: "amber",
  CLOSING: "amber",
  WON: "green",
  LOST: "red",
};

export const STATUS_TONES: Record<DealStatus, Tone> = {
  ACTIVE: "blue",
  WON: "green",
  LOST: "red",
};

export const ANALYSIS_LABELS: Record<AnalysisStatus, string> = {
  PENDING: "Queued",
  PROCESSING: "Analyzing",
  COMPLETED: "Analyzed",
  FAILED: "Analysis failed",
};

export const ANALYSIS_TONES: Record<AnalysisStatus, Tone> = {
  PENDING: "neutral",
  PROCESSING: "amber",
  COMPLETED: "green",
  FAILED: "red",
};

export const MEMORY_LABELS: Record<MemorySyncStatus, string> = {
  PENDING: "Walrus pending",
  PROCESSING: "Writing to Walrus",
  COMPLETED: "Synced to Walrus",
  FAILED: "Walrus failed",
};

export const MEMORY_TONES: Record<MemorySyncStatus, Tone> = {
  PENDING: "neutral",
  PROCESSING: "amber",
  COMPLETED: "green",
  FAILED: "red",
};

export const FACT_LABELS: Record<FactCategory, string> = {
  PAIN_POINT: "Pain points",
  OBJECTION: "Objections",
  BUYING_SIGNAL: "Buying signals",
  REQUIREMENT: "Requirements",
  COMMITMENT: "Commitments",
  STAKEHOLDER: "Stakeholders",
  BUDGET: "Budget",
  TIMELINE: "Timeline",
  DECISION_CRITERIA: "Decision criteria",
  OTHER: "Unresolved / other",
};

export const FACT_SINGULAR: Record<FactCategory, string> = {
  PAIN_POINT: "Pain point",
  OBJECTION: "Objection",
  BUYING_SIGNAL: "Buying signal",
  REQUIREMENT: "Requirement",
  COMMITMENT: "Commitment",
  STAKEHOLDER: "Stakeholder",
  BUDGET: "Budget",
  TIMELINE: "Timeline",
  DECISION_CRITERIA: "Decision criterion",
  OTHER: "Other observation",
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not set";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const FACT_TONES: Record<FactCategory, Tone> = {
  PAIN_POINT: "red",
  OBJECTION: "orange",
  BUYING_SIGNAL: "green",
  REQUIREMENT: "blue",
  COMMITMENT: "purple",
  STAKEHOLDER: "neutral",
  BUDGET: "amber",
  TIMELINE: "amber",
  DECISION_CRITERIA: "purple",
  OTHER: "neutral",
};
