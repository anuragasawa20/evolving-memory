"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Filter,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { MemoryDetailPanel } from "@/components/memory/memory-detail-panel";
import {
  MemoryGraph,
  type ExplorerFilterMode,
  type GraphFocusRequest,
} from "@/components/memory/memory-graph";
import { MemoryTimeline } from "@/components/memory/memory-timeline";
import { TechniqueForm } from "@/components/memory/technique-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FACT_LABELS,
  STAGE_LABELS,
  STAGE_TONES,
  STATUS_TONES,
} from "@/lib/display";
import { cn } from "@/lib/utils";
import { FACT_CATEGORIES } from "@/lib/validation";
import type { FactCategory } from "@/types/deal";
import type {
  CallNodeData,
  MemoryDetail,
  MemoryExplorerData,
  MemoryNodeData,
  RecommendationDetail,
  RecommendationStatus,
  TimelineEventView,
} from "@/types/memory";

const MODES: { value: ExplorerFilterMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "deal", label: "Deal" },
  { value: "learning", label: "Learning" },
  { value: "recommendations", label: "Recommendations" },
];

export function MemoryExplorer({
  dealId,
  initialData,
}: {
  dealId: string;
  initialData: MemoryExplorerData;
}) {
  const [data, setData] = useState(initialData);
  const [mode, setMode] = useState<ExplorerFilterMode>("all");
  const [categories, setCategories] = useState<Set<FactCategory>>(
    () => new Set(FACT_CATEGORIES),
  );
  const [showInferred, setShowInferred] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<GraphFocusRequest | null>(
    null,
  );
  const [memoryDetail, setMemoryDetail] = useState<MemoryDetail | null>(null);
  const [recommendationDetail, setRecommendationDetail] =
    useState<RecommendationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null,
  );
  const nonce = useRef(0);
  const selectedNodeRef = useRef<string | null>(null);
  const detailRequestRef = useRef(0);

  const loadDetail = useCallback(
    async (nodeId: string | null) => {
      const requestId = ++detailRequestRef.current;
      if (!nodeId) {
        setMemoryDetail(null);
        setRecommendationDetail(null);
        setDetailError(null);
        setDetailLoading(false);
        return;
      }

      const [prefix, id] = nodeId.split(":");
      if (prefix !== "memory" && prefix !== "recommendation") {
        setMemoryDetail(null);
        setRecommendationDetail(null);
        setDetailError(null);
        setDetailLoading(false);
        return;
      }

      setDetailLoading(true);
      setDetailError(null);

      const url =
        prefix === "memory"
          ? `/api/deals/${dealId}/memories/${id}`
          : `/api/deals/${dealId}/recommendations/${id}`;

      try {
        const response = await fetch(url, { cache: "no-store" });
        if (requestId !== detailRequestRef.current) return;
        if (!response.ok) {
          setDetailError("Unable to load this detail.");
          return;
        }
        const body = (await response.json()) as {
          memory?: MemoryDetail;
          recommendation?: RecommendationDetail;
        };
        if (prefix === "memory") {
          setMemoryDetail(body.memory ?? null);
          setRecommendationDetail(null);
        } else {
          setRecommendationDetail(body.recommendation ?? null);
          setMemoryDetail(null);
        }
      } catch {
        if (requestId === detailRequestRef.current) {
          setDetailError("Unable to load this detail.");
        }
      } finally {
        if (requestId === detailRequestRef.current) {
          setDetailLoading(false);
        }
      }
    },
    [dealId],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/deals/${dealId}/memory-explorer`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const body = (await response.json()) as MemoryExplorerData;
      setData(body);
      const current = selectedNodeRef.current;
      if (
        current &&
        !body.graph.nodes.some((node) => node.id === current)
      ) {
        selectedNodeRef.current = null;
        setSelectedNodeId(null);
        setMemoryDetail(null);
        setRecommendationDetail(null);
      } else if (current) {
        void loadDetail(current);
      }
    } catch {
      // Keep the last good explorer state on transient failures.
    } finally {
      setRefreshing(false);
    }
  }, [dealId, loadDetail]);

  useEffect(() => {
    if (!data.hasProcessing) return;
    const timer = setInterval(() => void refresh(), 5_000);
    return () => clearInterval(timer);
  }, [data.hasProcessing, refresh]);

  const activeSelectedNodeId =
    selectedNodeId &&
    data.graph.nodes.some((node) => node.id === selectedNodeId)
      ? selectedNodeId
      : null;

  const activeEventIds = useMemo(() => {
    if (selectedEventId) return new Set([selectedEventId]);
    if (!activeSelectedNodeId) return new Set<string>();
    return new Set(
      data.timeline
        .filter((event) =>
          event.relatedNodeIds.includes(activeSelectedNodeId),
        )
        .map((event) => event.id),
    );
  }, [data.timeline, activeSelectedNodeId, selectedEventId]);

  const selectNode = useCallback(
    (id: string | null) => {
      selectedNodeRef.current = id;
      setSelectedNodeId(id);
      setSelectedEventId(null);
      void loadDetail(id);
    },
    [loadDetail],
  );

  const selectTimelineEvent = useCallback(
    (event: TimelineEventView) => {
      const ids = event.relatedNodeIds;
      const primary = ids[0] ?? null;
      selectedNodeRef.current = primary;
      setSelectedEventId(event.id);
      setSelectedNodeId(primary);
      nonce.current += 1;
      setFocusRequest({ ids, nonce: nonce.current });
      void loadDetail(primary);
    },
    [loadDetail],
  );

  const toggleCategory = (category: FactCategory) => {
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const memoryOptions = useMemo(
    () =>
      data.graph.nodes
        .filter((node) => node.type === "memory")
        .map((node) => {
          const memory = node.data as MemoryNodeData;
          return {
            id: node.id.split(":")[1],
            label: FACT_LABELS[memory.category],
            content: memory.content,
          };
        }),
    [data.graph.nodes],
  );

  const latestCompletedCall = useMemo(() => {
    const calls = data.graph.nodes
      .filter((node) => node.type === "call")
      .map((node) => {
        const call = node.data as CallNodeData;
        return {
          id: node.id.split(":")[1],
          callNumber: call.callNumber,
          analysisStatus: call.analysisStatus,
        };
      })
      .filter((call) => call.analysisStatus === "COMPLETED")
      .sort((a, b) => b.callNumber - a.callNumber);
    return calls[0] ?? null;
  }, [data.graph.nodes]);

  const generateRecommendation = useCallback(async () => {
    if (!latestCompletedCall) return;
    setRecommendationLoading(true);
    setRecommendationError(null);
    try {
      const response = await fetch(`/api/deals/${dealId}/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: latestCompletedCall.id }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setRecommendationError(
          body?.error?.message ?? "Unable to generate a recommendation.",
        );
        return;
      }
      await refresh();
    } catch {
      setRecommendationError("Unable to generate a recommendation.");
    } finally {
      setRecommendationLoading(false);
    }
  }, [dealId, latestCompletedCall, refresh]);

  const onRecommendationStatusChange = useCallback(
    async (id: string, status: RecommendationStatus) => {
      const response = await fetch(
        `/api/deals/${dealId}/recommendations/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          recommendation: RecommendationDetail;
        };
        setRecommendationDetail(body.recommendation);
        void refresh();
      }
    },
    [dealId, refresh],
  );

  const summary = data.summary;
  const hasCalls = summary.totalCalls > 0;
  const hasMemories = summary.totalMemories > 0;

  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              <Link href="/deals" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                DealOS
              </Link>
              <span>/</span>
              <Link href="/deals" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Deals
              </Link>
              <span>/</span>
              <Link
                href={`/deals/${dealId}`}
                className="hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                {data.deal.customerName}
              </Link>
              <span>/</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                Memory Explorer
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Memory Explorer
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={STAGE_TONES[data.deal.stage]}>
                {STAGE_LABELS[data.deal.stage]}
              </Badge>
              <Badge tone={STATUS_TONES[data.deal.status]}>
                {data.deal.status}
              </Badge>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {data.deal.productName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data.hasProcessing ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Refreshing while analysis runs
              </span>
            ) : null}
            {latestCompletedCall ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void generateRecommendation()}
                disabled={recommendationLoading}
              >
                {recommendationLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Generate recommendation
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
            <Link
              href={`/deals/${dealId}`}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-300 px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Deal
            </Link>
          </div>
        </div>

        {recommendationError ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            {recommendationError}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Calls" value={summary.totalCalls} />
          <Stat label="Memories" value={summary.totalMemories} />
          <Stat label="Created" value={summary.totalCreated} />
          <Stat label="Refined" value={summary.totalRefined} />
          <Stat label="Recommendations" value={summary.totalRecommendations} />
          <Stat label="Techniques" value={summary.totalTechniques} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            <Filter className="h-3 w-3" />
            Filter
          </span>
          {MODES.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                mode === item.value
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400",
              )}
            >
              {item.label}
            </button>
          ))}

          <span className="mx-1 hidden h-4 w-px bg-neutral-200 sm:block dark:bg-neutral-700" />

          <details className="relative">
            <summary className="cursor-pointer list-none rounded-full border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              Memory categories ({categories.size}/{FACT_CATEGORIES.length})
            </summary>
            <div className="absolute left-0 z-30 mt-1 w-64 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex items-center justify-between px-1 pb-1">
                <button
                  type="button"
                  className="text-[10px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  onClick={() => setCategories(new Set(FACT_CATEGORIES))}
                >
                  All
                </button>
                <button
                  type="button"
                  className="text-[10px] font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                  onClick={() => setCategories(new Set())}
                >
                  None
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {FACT_CATEGORIES.map((category) => (
                  <label
                    key={category}
                    className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-[10px] hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <input
                      type="checkbox"
                      checked={categories.has(category)}
                      onChange={() => toggleCategory(category)}
                      className="h-3 w-3 accent-neutral-900 dark:accent-neutral-100"
                    />
                    <span className="truncate">{FACT_LABELS[category]}</span>
                  </label>
                ))}
              </div>
            </div>
          </details>

          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={showInferred}
              onChange={(event) => setShowInferred(event.target.checked)}
              className="h-3 w-3 accent-neutral-900 dark:accent-neutral-100"
            />
            Show inferred relationships
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <div>
                  <h2 className="text-sm font-semibold">Memory flow graph</h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Deal → calls → remembered knowledge → techniques → recommendations
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <span className="mr-1 text-[10px] text-neutral-400">
                    {data.graph.nodes.length} nodes · {data.graph.edges.length} edges
                  </span>
                  <Badge tone="green">
                    <BookOpen className="h-3 w-3" />
                    {summary.totalTechniques} techniques
                  </Badge>
                  <Badge tone="blue">
                    <Brain className="h-3 w-3" />
                    {summary.totalMemories} memories
                  </Badge>
                  <Badge tone="purple">
                    <Sparkles className="h-3 w-3" />
                    {summary.totalRecommendations} recs
                  </Badge>
                </div>
              </div>
              <div className="relative h-[min(68vh,680px)] min-h-[480px] w-full">
                <MemoryGraph
                  nodes={data.graph.nodes}
                  edges={data.graph.edges}
                  mode={mode}
                  selectedCategories={categories}
                  showInferred={showInferred}
                  selectedNodeId={activeSelectedNodeId}
                  focusRequest={focusRequest}
                  onSelectNode={selectNode}
                />
                {!hasCalls ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/55 p-6 text-center backdrop-blur-[1px] dark:bg-neutral-950/55">
                    <div className="pointer-events-auto max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                      <p className="text-sm font-semibold">
                        No conversations captured yet
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                        The explorer will populate as soon as the first
                        transcript is analyzed. Add a call from the deal
                        workspace to start building memory.
                      </p>
                      <Link
                        href={`/deals/${dealId}`}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200"
                      >
                        Go to deal workspace
                        <ArrowLeft className="h-3 w-3 rotate-180" />
                      </Link>
                    </div>
                  </div>
                ) : !hasMemories ? (
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                      {data.hasProcessing
                        ? "Conversation found. Memory reconciliation and Walrus sync are still running."
                        : "No memories were extracted from the captured conversations."}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <MemoryDetailPanel
              dealId={dealId}
              explorer={data}
              selectedNodeId={activeSelectedNodeId}
              memoryDetail={memoryDetail}
              recommendationDetail={recommendationDetail}
              loading={detailLoading}
              error={detailError}
              onSelectNode={selectNode}
              onRecommendationStatusChange={onRecommendationStatusChange}
            />
          </div>

          <aside className="min-w-0 space-y-4">
            <MemoryTimeline
              timeline={data.timeline}
              activeEventIds={activeEventIds}
              onSelectEvent={selectTimelineEvent}
            />
            <TechniqueForm
              dealId={dealId}
              memories={memoryOptions}
              onCreated={refresh}
            />
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                Walrus synchronization
              </p>
              <p className="mt-1">
                {summary.memorySync.completed} completed ·{" "}
                {summary.memorySync.failed} failed ·{" "}
                {summary.memorySync.pending} pending
              </p>
              <p className="mt-1">
                PostgreSQL and Walrus statuses are tracked independently and
                shown as separate timeline events.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
    </div>
  );
}
