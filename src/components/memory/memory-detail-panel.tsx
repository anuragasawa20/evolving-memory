"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  History,
  Loader2,
  Quote,
  Sparkles,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ANALYSIS_LABELS,
  ANALYSIS_TONES,
  FACT_SINGULAR,
  FACT_TONES,
  MEMORY_LABELS,
  MEMORY_TONES,
  STAGE_LABELS,
  STAGE_TONES,
  formatDateTime,
} from "@/lib/display";
import { cn } from "@/lib/utils";
import type {
  MemoryDetail,
  MemoryExplorerData,
  MemoryGraphNode,
  RecommendationDetail,
  RecommendationStatus,
} from "@/types/memory";

function nodeId(prefix: string, id: string): string {
  return `${prefix}:${id}`;
}

function explicitLabel(isInferred: boolean): { text: string; tone: Tone } {
  return isInferred
    ? { text: "Inferred classification", tone: "amber" }
    : { text: "Explicit evidence", tone: "green" };
}

function confidenceLabel(value: number | null): string | null {
  return typeof value === "number" ? `${Math.round(value * 100)}% confidence` : null;
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="shrink-0 text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span className="text-right font-medium text-neutral-800 dark:text-neutral-200">
        {value}
      </span>
    </div>
  );
}

const STATUS_TONES: Record<RecommendationStatus, Tone> = {
  SUGGESTED: "blue",
  ACCEPTED: "green",
  MODIFIED: "amber",
  DISMISSED: "neutral",
  EXECUTED: "purple",
  OUTCOME_PENDING: "amber",
  OUTCOME_RECORDED: "green",
};

export function MemoryDetailPanel({
  dealId,
  explorer,
  selectedNodeId,
  memoryDetail,
  recommendationDetail,
  loading,
  error,
  onSelectNode,
  onRecommendationStatusChange,
}: {
  dealId: string;
  explorer: MemoryExplorerData;
  selectedNodeId: string | null;
  memoryDetail: MemoryDetail | null;
  recommendationDetail: RecommendationDetail | null;
  loading: boolean;
  error: string | null;
  onSelectNode: (id: string) => void;
  onRecommendationStatusChange: (
    id: string,
    status: RecommendationStatus,
  ) => Promise<void>;
}) {
  const selectedNode: MemoryGraphNode | undefined = selectedNodeId
    ? explorer.graph.nodes.find((node) => node.id === selectedNodeId)
    : undefined;
  const prefix = selectedNodeId?.split(":")[0] ?? null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-sm font-semibold">Selected details</h2>
        {loading ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading detail
          </span>
        ) : selectedNode ? (
          <span className="text-[11px] text-neutral-400">
            {prefix === "memory"
              ? "Memory"
              : prefix === "recommendation"
                ? "Recommendation"
                : prefix === "call"
                  ? "Call"
                  : prefix === "technique"
                    ? "Technique"
                    : "Deal"}
          </span>
        ) : null}
      </div>

      <div className="max-h-[420px] overflow-y-auto px-4 py-4">
        {error ? (
          <p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">
            {error}
          </p>
        ) : null}

        {!selectedNode ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <CircleHelp className="h-6 w-6 text-neutral-400" />
            <p className="text-sm font-medium">Select a graph node or timeline event</p>
            <p className="max-w-md text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Memories show their evidence, versions and provenance. Recommendations
              show the memories that influenced them. Suggested actions are never
              presented as executed.
            </p>
          </div>
        ) : prefix === "memory" && memoryDetail ? (
          <MemoryDetailView
            detail={memoryDetail}
            onSelectNode={onSelectNode}
          />
        ) : prefix === "recommendation" && recommendationDetail ? (
          <RecommendationDetailView
            detail={recommendationDetail}
            onSelectNode={onSelectNode}
            onStatusChange={onRecommendationStatusChange}
          />
        ) : prefix === "call" ? (
          <CallDetailView dealId={dealId} node={selectedNode} />
        ) : prefix === "technique" ? (
          <TechniqueDetailView node={selectedNode} onSelectNode={onSelectNode} />
        ) : (
          <DealDetailView dealId={dealId} explorer={explorer} node={selectedNode} />
        )}
      </div>
    </div>
  );
}

function MemoryDetailView({
  detail,
  onSelectNode,
}: {
  detail: MemoryDetail;
  onSelectNode: (id: string) => void;
}) {
  const classification = explicitLabel(detail.isInferred);
  const confidence = confidenceLabel(detail.confidence);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={FACT_TONES[detail.category]}>
          {FACT_SINGULAR[detail.category]}
        </Badge>
        <Badge tone={classification.tone}>{classification.text}</Badge>
        {confidence ? <Badge tone="neutral">{confidence}</Badge> : null}
      </div>

      <p className="text-sm font-medium leading-relaxed text-neutral-900 dark:text-neutral-100">
        {detail.content}
      </p>

      {detail.evidence ? (
        <blockquote className="flex gap-2 rounded-md bg-neutral-50 px-3 py-2 text-xs italic leading-relaxed text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400">
          <Quote className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{detail.evidence}</span>
        </blockquote>
      ) : (
        <p className="rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          No direct transcript quote was recorded for this memory.
        </p>
      )}

      <Section title="Provenance">
        <div className="space-y-1.5 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <Field
            label="Source call"
            value={
              detail.sourceCall ? (
                <Link
                  href={`/deals/${detail.dealId}/calls/${detail.sourceCall.id}`}
                  className="text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200"
                >
                  Call {detail.sourceCall.callNumber}
                  {detail.sourceCall.title ? ` - ${detail.sourceCall.title}` : ""}
                </Link>
              ) : (
                "Not recorded"
              )
            }
          />
          <Field label="Created" value={formatDateTime(detail.createdAt)} />
          <Field label="Last updated" value={formatDateTime(detail.updatedAt)} />
          <Field
            label="Versions"
            value={`${detail.versions.length} preserved`}
          />
        </div>
      </Section>

      {detail.previousVersion ? (
        <Section title="Previous version">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 dark:border-amber-500/20">
            <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
              v{detail.previousVersion.versionNumber} ·{" "}
              {formatDateTime(detail.previousVersion.createdAt)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
              {detail.previousVersion.content}
            </p>
            {detail.previousVersion.evidence ? (
              <p className="mt-1 text-[11px] italic text-neutral-500 dark:text-neutral-400">
                “{detail.previousVersion.evidence}”
              </p>
            ) : null}
            {detail.previousVersion.changeReason ? (
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                {detail.previousVersion.changeReason}
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {detail.learningEvents.length > 0 ? (
        <Section title="Learning history">
          <ol className="space-y-2">
            {detail.learningEvents.map((event) => (
              <li
                key={event.id}
                className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <Badge
                    tone={
                      event.action === "CONTRADICTED"
                        ? "red"
                        : event.action === "REFINED"
                          ? "amber"
                          : event.action === "CONFIRMED"
                            ? "green"
                            : "blue"
                    }
                  >
                    {event.action}
                  </Badge>
                  <span className="text-[10px] text-neutral-400">
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {event.reason ?? "No reason recorded."}
                </p>
                {event.sourceCall ? (
                  <p className="mt-1 text-[10px] text-neutral-400">
                    From Call {event.sourceCall.callNumber}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {detail.relatedMemories.length > 0 ? (
        <Section title="Related memories">
          <div className="flex flex-wrap gap-1.5">
            {detail.relatedMemories.map((related) => (
              <button
                key={`${related.id}-${related.relationshipType}-${related.direction}`}
                type="button"
                onClick={() => onSelectNode(nodeId("memory", related.id))}
                className="rounded-md border border-neutral-200 px-2 py-1 text-left text-[11px] transition hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
              >
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                  {related.relationshipType}
                </span>{" "}
                <span className="text-neutral-500 dark:text-neutral-400">
                  {related.content.slice(0, 80)}
                  {related.content.length > 80 ? "…" : ""}
                </span>
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      {detail.recommendations.length > 0 ? (
        <Section title="Recommendations influenced">
          <div className="space-y-1.5">
            {detail.recommendations.map((recommendation) => (
              <button
                key={recommendation.id}
                type="button"
                onClick={() =>
                  onSelectNode(nodeId("recommendation", recommendation.id))
                }
                className="flex w-full items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-left transition hover:border-emerald-500/60"
              >
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    {recommendation.content}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-neutral-500 dark:text-neutral-400">
                    {recommendation.contribution ?? recommendation.status}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      {detail.techniques.length > 0 ? (
        <Section title="Personal techniques">
          <ul className="space-y-1.5">
            {detail.techniques.map((technique) => (
              <li key={technique.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(nodeId("technique", technique.id))}
                  className="flex w-full items-start gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-left transition hover:border-violet-500/60"
                >
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span>
                    <span className="block text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {technique.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-neutral-500 dark:text-neutral-400">
                      {technique.description}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {detail.versions.length > 1 ? (
        <details>
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
            <History className="h-3.5 w-3.5" />
            All {detail.versions.length} versions
          </summary>
          <ol className="mt-2 space-y-2">
            {detail.versions.map((version) => (
              <li
                key={version.id}
                className="rounded-md border border-neutral-200 px-3 py-2 text-[11px] dark:border-neutral-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    v{version.versionNumber}
                  </span>
                  <span className="text-neutral-400">
                    {formatDateTime(version.createdAt)}
                  </span>
                </div>
                <p className="mt-1 leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {version.content}
                </p>
                {version.sourceCall ? (
                  <p className="mt-1 text-[10px] text-neutral-400">
                    Source: Call {version.sourceCall.callNumber}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

function RecommendationDetailView({
  detail,
  onSelectNode,
  onStatusChange,
}: {
  detail: RecommendationDetail;
  onSelectNode: (id: string) => void;
  onStatusChange: (id: string, status: RecommendationStatus) => Promise<void>;
}) {
  const [pending, setPending] = useState<RecommendationStatus | null>(null);

  async function update(status: RecommendationStatus) {
    setPending(status);
    try {
      await onStatusChange(detail.id, status);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_TONES[detail.status]}>{detail.status}</Badge>
        {detail.confidence !== null ? (
          <Badge tone="neutral">{confidenceLabel(detail.confidence)}</Badge>
        ) : null}
        {detail.call ? <Badge tone="neutral">Call {detail.call.callNumber}</Badge> : null}
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          <Sparkles className="h-3 w-3" />
          Suggested next action
        </p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-neutral-900 dark:text-neutral-100">
          {detail.content}
        </p>
        <p className="mt-2 text-[10px] text-neutral-500 dark:text-neutral-400">
          This is a proposal. It does not mean the action was executed.
        </p>
      </div>

      <Section title="Reasoning">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
          {detail.reasoning ?? "No reasoning was recorded."}
        </p>
      </Section>

      {detail.caseContext || detail.playbook || detail.organizationalEvidence ? (
        <Section title="Organizational context">
          <div className="space-y-2 rounded-lg border border-blue-500/25 bg-blue-500/5 p-3">
            {detail.caseContext ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="blue">
                  {detail.caseContext.categoryName}
                </Badge>
                <Badge tone="neutral">{detail.caseContext.subtype}</Badge>
              </div>
            ) : null}
            {detail.caseContext?.description ? (
              <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                {detail.caseContext.description}
              </p>
            ) : null}
            {detail.playbook ? (
              <div className="rounded-md border border-neutral-200 bg-white/60 px-2 py-1.5 text-[11px] dark:border-neutral-700 dark:bg-neutral-900/60">
                <p className="font-medium text-neutral-800 dark:text-neutral-200">
                  {detail.playbook.title}
                </p>
                <p className="text-neutral-500 dark:text-neutral-400">
                  {detail.playbook.strategyName
                    ? `Strategy: ${detail.playbook.strategyName}`
                    : "No strategy selected"}
                  {" · "}
                  {detail.playbook.status}
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                No approved organizational playbook matched this case.
              </p>
            )}
            {detail.organizationalEvidence ? (
              <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                {detail.organizationalEvidence}
              </p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {detail.uncertainty ? (
        <Section title="Uncertainty">
          <p className="flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {detail.uncertainty}
          </p>
        </Section>
      ) : null}

      {detail.nextStep ? (
        <Section title="Immediate next step">
          <p className="rounded-md border border-neutral-200 px-3 py-2 text-xs leading-relaxed dark:border-neutral-800">
            {detail.nextStep}
          </p>
        </Section>
      ) : null}

      <Section title="Influencing memories">
        {detail.memories.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            No influencing memories were recorded.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {detail.memories.map((memory) => (
              <li key={memory.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(nodeId("memory", memory.id))}
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                >
                  <div className="flex items-center gap-1.5">
                    <Badge tone={FACT_TONES[memory.category]}>
                      {FACT_SINGULAR[memory.category]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    {memory.content}
                  </p>
                  {memory.contribution ? (
                    <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                      {memory.contribution}
                    </p>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {detail.techniques.length > 0 ? (
        <Section title="Relevant personal techniques">
          <ul className="space-y-1.5">
            {detail.techniques.map((technique) => (
              <li key={technique.id}>
                <button
                  type="button"
                  onClick={() => onSelectNode(nodeId("technique", technique.id))}
                  className="w-full rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-left transition hover:border-violet-500/60"
                >
                  <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                    {technique.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                    {technique.description}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {detail.status === "SUGGESTED" ? (
        <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => update("ACCEPTED")}
          >
            {pending === "ACCEPTED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Mark accepted
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => update("DISMISSED")}
          >
            {pending === "DISMISSED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Dismiss suggestion
          </Button>
        </div>
      ) : detail.status === "ACCEPTED" || detail.status === "MODIFIED" ? (
        <div className="space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => update("EXECUTED")}
          >
            {pending === "EXECUTED" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Mark executed
          </Button>
          <p className="text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            Marking executed creates an outcome-tracking record. It does not
            claim the strategy succeeded.
          </p>
        </div>
      ) : detail.status === "OUTCOME_PENDING" ? (
        <p className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
          Execution is recorded. The next analyzed call can record an observed
          outcome without assuming causality.
        </p>
      ) : null}
    </div>
  );
}

function CallDetailView({
  dealId,
  node,
}: {
  dealId: string;
  node: MemoryGraphNode;
}) {
  const data = node.data as extractCallData;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="blue">Call {data.callNumber}</Badge>
        <Badge tone={ANALYSIS_TONES[data.analysisStatus]}>
          {ANALYSIS_LABELS[data.analysisStatus]}
        </Badge>
        {data.memorySyncStatus ? (
          <Badge tone={MEMORY_TONES[data.memorySyncStatus]}>
            {MEMORY_LABELS[data.memorySyncStatus]}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm font-medium">{data.subtitle}</p>
      <Field
        label="Call date"
        value={data.callDate ? formatDateTime(data.callDate) : "Not recorded"}
      />
      <Link
        href={`/deals/${dealId}/calls/${node.id.split(":")[1]}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:underline dark:text-neutral-300"
      >
        Open call details
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

type extractCallData = {
  callNumber: number;
  subtitle: string;
  callDate: string | null;
  analysisStatus: import("@/types/deal").AnalysisStatus;
  memorySyncStatus: import("@/types/deal").MemorySyncStatus | null;
};

function TechniqueDetailView({
  node,
  onSelectNode,
}: {
  node: MemoryGraphNode;
  onSelectNode: (id: string) => void;
}) {
  const data = node.data as {
    label: string;
    subtitle: string;
    source?: string | null;
    memoryId?: string | null;
    createdAt?: string;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="purple">
          <BookOpen className="h-3 w-3" />
          Personal technique
        </Badge>
      </div>
      <p className="text-sm font-semibold">{data.label}</p>
      <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
        {data.subtitle}
      </p>
      <Field label="Source" value={data.source || "Self-recorded"} />
      {data.createdAt ? (
        <Field label="Added" value={formatDateTime(data.createdAt)} />
      ) : null}
      {data.memoryId ? (
        <button
          type="button"
          onClick={() => onSelectNode(nodeId("memory", data.memoryId!))}
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:underline dark:text-neutral-300"
        >
          Open addressed memory
          <ArrowUpRight className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}

function DealDetailView({
  dealId,
  explorer,
  node,
}: {
  dealId: string;
  explorer: MemoryExplorerData;
  node: MemoryGraphNode;
}) {
  const data = node.data as {
    label: string;
    subtitle: string;
    stage: import("@/types/deal").DealStage;
    status: import("@/types/deal").DealStatus;
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={STAGE_TONES[data.stage]}>{STAGE_LABELS[data.stage]}</Badge>
        <Badge tone={data.status === "WON" ? "green" : data.status === "LOST" ? "red" : "blue"}>
          {data.status}
        </Badge>
      </div>
      <div>
        <p className="text-lg font-semibold">{data.label}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {data.subtitle}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Calls" value={explorer.summary.totalCalls} />
        <Stat label="Memories" value={explorer.summary.totalMemories} />
        <Stat label="Created" value={explorer.summary.totalCreated} />
        <Stat label="Refined" value={explorer.summary.totalRefined} />
        <Stat label="Techniques" value={explorer.summary.totalTechniques} />
        <Stat
          label="Recommendations"
          value={explorer.summary.totalRecommendations}
        />
      </div>
      <Link
        href={`/deals/${dealId}`}
        className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:underline dark:text-neutral-300"
      >
        Open deal workspace
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
    </div>
  );
}
