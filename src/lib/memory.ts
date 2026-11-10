import { MemWal } from "@mysten-incubation/memwal";
import { assertEnv } from "./env";

export function getMemoryEnv() {
  return assertEnv("memory");
}

/**
 * Create a server-side Walrus Memory client for the given namespace.
 *
 * The delegate private key and account ID are read from server-only env vars.
 * Callers should `destroy()` the client when finished to wipe key material.
 */
export function createMemoryClient(namespace?: string): MemWal {
  const env = getMemoryEnv();

  return MemWal.create({
    key: env.MEMWAL_PRIVATE_KEY,
    accountId: env.MEMWAL_ACCOUNT_ID,
    serverUrl: env.MEMWAL_SERVER_URL,
    namespace: namespace ?? env.MEMWAL_NAMESPACE,
    requestTimeoutMs: 30_000,
  });
}

export interface MemoryFactInput {
  category: string;
  content: string;
  evidence?: string | null;
  metadata?: Record<string, unknown> | null;
}

const FACT_LABELS: Record<string, string> = {
  PAIN_POINT: "Customer pain point",
  OBJECTION: "Objection",
  BUYING_SIGNAL: "Buying signal",
  REQUIREMENT: "Requirement",
  COMMITMENT: "Commitment",
  STAKEHOLDER: "Stakeholder",
  BUDGET: "Budget information",
  TIMELINE: "Timeline information",
  DECISION_CRITERIA: "Decision criteria",
  OTHER: "Other observation",
};

const MAX_MEMORY_TEXT_LENGTH = 12_000;

function factLabel(fact: MemoryFactInput): string {
  if (
    fact.category === "OTHER" &&
    fact.metadata &&
    fact.metadata.kind === "unresolved_question"
  ) {
    return "Unresolved question";
  }
  return FACT_LABELS[fact.category] ?? "Observation";
}

function severityLabel(fact: MemoryFactInput): string {
  const severity = fact.metadata?.severity;
  return fact.category === "OBJECTION" && typeof severity === "string"
    ? ` (severity: ${severity})`
    : "";
}

/**
 * Build the carefully constructed call-analysis text that is sent to Walrus
 * Memory. It deliberately excludes the raw transcript and includes stable
 * source identifiers so related memories can be scoped back to a deal and call.
 */
export function buildCallMemoryText(params: {
  dealId: string;
  callId: string;
  callNumber: number;
  customerName: string;
  productName: string;
  callTitle?: string | null;
  observedAt: Date;
  summary: string;
  facts: MemoryFactInput[];
}): string {
  const lines: string[] = [
    `Deal ID: ${params.dealId}`,
    `Call ID: ${params.callId}`,
    `Call Number: ${params.callNumber}`,
    "Source: Sales call transcript",
    `Observed date: ${params.observedAt.toISOString().slice(0, 10)}`,
    `Deal: ${params.customerName} - ${params.productName}`,
  ];

  if (params.callTitle) {
    lines.push(`Call title: ${params.callTitle}`);
  }

  lines.push("", `Call summary: ${params.summary}`);

  for (const fact of params.facts) {
    lines.push("", `${factLabel(fact)}${severityLabel(fact)}: ${fact.content}`);
    if (fact.evidence) {
      lines.push(`Evidence: ${fact.evidence}`);
    }
  }

  const text = lines.join("\n").trim();
  if (text.length <= MAX_MEMORY_TEXT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_MEMORY_TEXT_LENGTH)}\n[truncated]`;
}

export function buildMemoryRecallQuery(dealId: string, query: string): string {
  return `Deal ID: ${dealId}. ${query.trim()}`;
}
