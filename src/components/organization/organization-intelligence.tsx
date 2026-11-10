"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Database,
  FlaskConical,
  GitBranch,
  Layers,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { formatDate, formatDateTime } from "@/lib/display";
import { cn } from "@/lib/utils";
import type {
  CaseLibraryCategoryView,
  LearningInsightView,
  OrganizationIntelligenceView,
  PlaybookView,
  StrategyEvidenceView,
  StrategyExplorerView,
  WalrusRecallView,
  WalrusSyncEntryView,
} from "@/types/organization";

type Tab = "cases" | "strategies" | "playbooks" | "insights" | "walrus";

const TABS: { value: Tab; label: string; icon: typeof Brain }[] = [
  { value: "cases", label: "Case Library", icon: Layers },
  { value: "strategies", label: "Strategy Explorer", icon: GitBranch },
  { value: "playbooks", label: "Playbooks", icon: ShieldCheck },
  { value: "insights", label: "Learning Insights", icon: Sparkles },
  { value: "walrus", label: "Walrus Memory", icon: Database },
];

const PLAYBOOK_TONES: Record<string, Tone> = {
  DRAFT: "neutral",
  EVIDENCE_ACCUMULATING: "blue",
  REVIEW_REQUIRED: "amber",
  APPROVED: "green",
  ACTIVE: "green",
  REVISED: "orange",
  ARCHIVED: "neutral",
};

const APPROVAL_TONES: Record<string, Tone> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

const SYNC_TONES: Record<string, Tone> = {
  COMPLETED: "green",
  FAILED: "red",
  PENDING: "amber",
  PROCESSING: "amber",
};

function outcomeTone(outcomeType: string): Tone {
  if (
    [
      "POSITIVE_RESPONSE",
      "MEETING_BOOKED",
      "DEMO_ACCEPTED",
      "PROPOSAL_REQUESTED",
      "OBJECTION_RESOLVED",
      "DEAL_ADVANCED",
      "DEAL_WON",
    ].includes(outcomeType)
  ) {
    return "green";
  }
  if (outcomeType === "DEAL_LOST") return "red";
  return "neutral";
}

function confidenceLabel(confidence: number | null): string | null {
  return typeof confidence === "number"
    ? `${Math.round(confidence * 100)}% confidence`
    : null;
}

function collectBlobIds(value: unknown, seen = new Set<string>()): string[] {
  const ids: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) ids.push(...collectBlobIds(item, seen));
    return ids;
  }
  if (!value || typeof value !== "object") return ids;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (
      (key === "blobId" || key === "blob_id") &&
      typeof item === "string" &&
      !seen.has(item)
    ) {
      seen.add(item);
      ids.push(item);
      continue;
    }
    if (item && typeof item === "object") {
      ids.push(...collectBlobIds(item, seen));
    }
  }
  return ids;
}

function collectOwner(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const owner = collectOwner(item);
      if (owner) return owner;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.owner === "string" && record.owner.startsWith("0x")) {
    return record.owner;
  }
  for (const item of Object.values(record)) {
    const owner = collectOwner(item);
    if (owner) return owner;
  }
  return null;
}

export function OrganizationIntelligence({
  initialData,
  initialTab,
}: {
  initialData: OrganizationIntelligenceView;
  initialTab?: Tab;
}) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>(initialTab ?? "cases");
  const [selectedCase, setSelectedCase] = useState<{
    categoryCode: string;
    subtype: string | null;
  } | null>(null);
  const [explorer, setExplorer] = useState<StrategyExplorerView | null>(null);
  const [explorerLoading, setExplorerLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walrusQuery, setWalrusQuery] = useState("");
  const [walrusRecall, setWalrusRecall] = useState<WalrusRecallView | null>(
    null,
  );
  const [walrusLoading, setWalrusLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState<{
    tone: Tone;
    text: string;
  } | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/organization/intelligence", {
        cache: "no-store",
      });
      if (response.ok) {
        setData((await response.json()) as OrganizationIntelligenceView);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadExplorer = useCallback(
    async (categoryCode: string, subtype: string | null) => {
      setExplorerLoading(true);
      try {
        const params = new URLSearchParams({ categoryCode });
        if (subtype) params.set("subtype", subtype);
        const response = await fetch(
          `/api/organization/cases?${params.toString()}`,
          { cache: "no-store" },
        );
        if (response.ok) {
          setExplorer((await response.json()) as StrategyExplorerView);
        }
      } finally {
        setExplorerLoading(false);
      }
    },
    [],
  );

  const selectCase = useCallback(
    (categoryCode: string, subtype: string | null) => {
      setSelectedCase({ categoryCode, subtype });
      setTab("strategies");
      void loadExplorer(categoryCode, subtype);
    },
    [loadExplorer],
  );

  const draftPlaybook = useCallback(
    async (categoryCode: string, subtype: string) => {
      setMessage({ tone: "blue", text: "Generating evidence-backed draft…" });
      try {
        const response = await fetch("/api/organization/playbooks/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryCode, subtype }),
        });
        const body = (await response.json()) as {
          playbook?: { version: number };
          error?: { message?: string };
        };
        if (!response.ok) {
          setMessage({
            tone: "red",
            text: body.error?.message ?? "Unable to create playbook draft.",
          });
          return;
        }
        setMessage({
          tone: "green",
          text: `Draft version ${body.playbook?.version ?? 1} created. Review it before approval.`,
        });
        await refresh();
        setTab("playbooks");
      } catch {
        setMessage({ tone: "red", text: "Unable to create playbook draft." });
      }
    },
    [refresh],
  );

  const approve = useCallback(
    async (versionId: string) => {
      setMessage({ tone: "blue", text: "Approving and publishing to Walrus…" });
      try {
        const response = await fetch(
          `/api/organization/playbooks/versions/${versionId}/approve`,
          { method: "POST" },
        );
        const body = (await response.json()) as {
          walrus?: { status?: string; errorMessage?: string };
          error?: { message?: string };
        };
        if (!response.ok) {
          setMessage({
            tone: "red",
            text: body.error?.message ?? "Unable to approve playbook.",
          });
          return;
        }
        setMessage({
          tone: body.walrus?.status === "COMPLETED" ? "green" : "amber",
          text:
            body.walrus?.status === "COMPLETED"
              ? "Playbook approved and published to Walrus."
              : `Playbook approved locally, but Walrus sync is ${body.walrus?.status ?? "pending"}: ${body.walrus?.errorMessage ?? "retry from the Walrus tab"}.`,
        });
        await refresh();
        if (selectedCase) {
          await loadExplorer(selectedCase.categoryCode, selectedCase.subtype);
        }
      } catch {
        setMessage({ tone: "red", text: "Unable to approve playbook." });
      }
    },
    [loadExplorer, refresh, selectedCase],
  );

  const reject = useCallback(
    async (versionId: string) => {
      try {
        const response = await fetch(
          `/api/organization/playbooks/versions/${versionId}/reject`,
          { method: "POST" },
        );
        if (response.ok) {
          setMessage({ tone: "neutral", text: "Playbook version rejected." });
          await refresh();
        }
      } catch {
        setMessage({ tone: "red", text: "Unable to reject playbook version." });
      }
    },
    [refresh],
  );

  const searchWalrus = useCallback(async () => {
    if (walrusQuery.trim().length < 2) return;
    setWalrusLoading(true);
    try {
      const response = await fetch(
        `/api/organization/walrus?query=${encodeURIComponent(walrusQuery)}`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          recall: WalrusRecallView | null;
        };
        setWalrusRecall(body.recall);
      }
    } finally {
      setWalrusLoading(false);
    }
  }, [walrusQuery]);

  const retrySync = useCallback(
    async (syncId: string) => {
      setMessage({ tone: "blue", text: "Retrying Walrus sync…" });
      try {
        const response = await fetch("/api/organization/walrus/retry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncId }),
        });
        if (response.ok) {
          setMessage({ tone: "green", text: "Walrus sync retried." });
          await refresh();
        } else {
          setMessage({ tone: "red", text: "Walrus retry failed." });
        }
      } catch {
        setMessage({ tone: "red", text: "Walrus retry failed." });
      }
    },
    [refresh],
  );

  const syncPending = useCallback(async () => {
    setMessage({ tone: "blue", text: "Syncing pending Walrus memories…" });
    try {
      const response = await fetch("/api/organization/walrus/sync-pending", {
        method: "POST",
      });
      const body = (await response.json()) as {
        results?: { status?: string }[];
        error?: { message?: string };
      };
      if (!response.ok) {
        setMessage({
          tone: "red",
          text: body.error?.message ?? "Unable to sync pending memories.",
        });
        return;
      }
      const completed =
        body.results?.filter((item) => item.status === "COMPLETED").length ?? 0;
      setMessage({
        tone: "green",
        text: `Synced ${completed} pending Walrus memory record(s).`,
      });
      await refresh();
    } catch {
      setMessage({ tone: "red", text: "Unable to sync pending memories." });
    }
  }, [refresh]);

  const seed = useCallback(async () => {
    setSeeding(true);
    setMessage({
      tone: "blue",
      text: "Creating synthetic multi-rep cases and writing them to Walrus…",
    });
    try {
      const response = await fetch("/api/organization/seed", { method: "POST" });
      const body = (await response.json()) as {
        created?: {
          cases?: number;
          playbooks?: number;
          techniques?: number;
          deals?: number;
        };
        walrus?: { caseSyncs?: { completed?: number; failed?: number } };
        notice?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        setMessage({
          tone: "red",
          text: body.error?.message ?? "Unable to seed synthetic data.",
        });
        return;
      }
      setMessage({
        tone:
          (body.walrus?.caseSyncs?.failed ?? 0) > 0 ? "amber" : "green",
        text: `Seeded ${body.created?.cases ?? 0} cases, ${
          body.created?.playbooks ?? 0
        } playbook drafts and ${body.created?.techniques ?? 0} techniques. Walrus completed ${
          body.walrus?.caseSyncs?.completed ?? 0
        } case memories. ${body.notice ?? ""}`,
      });
      setExplorer(null);
      setSelectedCase(null);
      setTab("cases");
      await refresh();
    } catch {
      setMessage({ tone: "red", text: "Unable to seed synthetic data." });
    } finally {
      setSeeding(false);
    }
  }, [refresh]);

  const totals = data.totals;
  const synthetic = totals.syntheticCases > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>DealOS</span>
            <span>/</span>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              Organization Intelligence
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Organizational learning
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="blue">
              <Users className="h-3 w-3" />
              {data.organization.name}
            </Badge>
            <Badge tone="neutral">
              {data.organization.salespeople.length} salespeople
            </Badge>
            {synthetic ? (
              <Badge tone="amber">
                <FlaskConical className="h-3 w-3" />
                Synthetic dataset
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button size="sm" onClick={() => void seed()} disabled={seeding}>
            {seeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FlaskConical className="h-3.5 w-3.5" />
            )}
            {synthetic ? "Refresh synthetic demo" : "Load synthetic demo"}
          </Button>
        </div>
      </div>

      {synthetic ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This workspace contains synthetic multi-rep examples for the
            hackathon. They demonstrate the learning loop and must not be
            represented as actual customer performance.
          </span>
        </div>
      ) : null}

      {message ? (
        <div
          className={cn(
            "mt-4 rounded-lg border px-3 py-2 text-xs",
            message.tone === "green"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : message.tone === "red"
                ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                : message.tone === "amber"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
          )}
        >
          {message.text}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Cases" value={totals.cases} />
        <Stat label="Executions" value={totals.strategyExecutions} />
        <Stat label="Outcomes" value={totals.outcomes} />
        <Stat label="Strategies" value={totals.strategies} />
        <Stat label="Playbooks" value={totals.playbooks} />
        <Stat label="Active" value={totals.activePlaybooks} />
        <Stat label="Walrus synced" value={data.walrus.statusCounts.completed} />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5 border-b border-neutral-200 pb-2 dark:border-neutral-800">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setTab(item.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition",
                tab === item.value
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "cases" ? (
          <CaseLibrary
            categories={data.caseLibrary}
            onSelectCase={selectCase}
            onSeed={() => void seed()}
            seeding={seeding}
          />
        ) : null}
        {tab === "strategies" ? (
          <StrategyExplorer
            key={
              selectedCase
                ? `${selectedCase.categoryCode}:${selectedCase.subtype ?? "all"}`
                : "none"
            }
            explorer={explorer}
            loading={explorerLoading}
            selectedCase={selectedCase}
            taxonomy={data.taxonomy}
            mainnet={data.walrus.mainnet}
            onDraft={draftPlaybook}
            walrusRecall={walrusRecall}
            walrusLoading={walrusLoading}
            walrusQuery={walrusQuery}
            onWalrusQueryChange={setWalrusQuery}
            onSearchWalrus={() => void searchWalrus()}
          />
        ) : null}
        {tab === "playbooks" ? (
          <PlaybookList
            playbooks={data.playbooks}
            onApprove={(id) => void approve(id)}
            onReject={(id) => void reject(id)}
          />
        ) : null}
        {tab === "insights" ? (
          <Insights insights={data.insights} />
        ) : null}
        {tab === "walrus" ? (
          <WalrusPanel
            data={data}
            recall={walrusRecall}
            query={walrusQuery}
            loading={walrusLoading}
            onQueryChange={setWalrusQuery}
            onSearch={() => void searchWalrus()}
            onRetry={retrySync}
            onSyncPending={() => void syncPending()}
            onSeed={() => void seed()}
            seeding={seeding}
          />
        ) : null}
      </div>
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

function CaseLibrary({
  categories,
  onSelectCase,
  onSeed,
  seeding,
}: {
  categories: CaseLibraryCategoryView[];
  onSelectCase: (categoryCode: string, subtype: string | null) => void;
  onSeed: () => void;
  seeding: boolean;
}) {
  if (categories.length === 0) {
    return (
      <EmptyState
        title="No recurring cases yet"
        description="Analyze sales conversations or load the synthetic multi-rep demo to build the case library."
        action={
          <Button size="sm" onClick={onSeed} disabled={seeding}>
            {seeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FlaskConical className="h-3.5 w-3.5" />
            )}
            Load synthetic demo
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <div
          key={category.categoryCode}
          className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                {category.categoryCode}
              </p>
              <h3 className="mt-0.5 text-sm font-semibold">
                {category.categoryName}
              </h3>
            </div>
            <div className="text-right">
              <p className="text-2xl font-semibold leading-none">
                {category.totalCases}
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                cases
              </p>
            </div>
          </div>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            {category.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {category.subtypes.map((subtype) => (
              <button
                key={subtype.subtype}
                type="button"
                onClick={() =>
                  onSelectCase(category.categoryCode, subtype.subtype)
                }
                className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                {subtype.label} · {subtype.count}
                {subtype.positive > 0 ? (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                    +{subtype.positive}
                  </span>
                ) : null}
                {subtype.negative > 0 ? (
                  <span className="ml-1 text-red-600 dark:text-red-400">
                    −{subtype.negative}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2 text-[10px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <span>
              Last observed{" "}
              {category.lastObservedAt ? formatDate(category.lastObservedAt) : "—"}
            </span>
            <button
              type="button"
              onClick={() => onSelectCase(category.categoryCode, null)}
              className="inline-flex items-center gap-1 font-medium text-neutral-700 hover:underline dark:text-neutral-300"
            >
              Explore
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {category.syntheticCases > 0 ? (
            <div className="mt-2">
              <Badge tone="amber">Synthetic examples</Badge>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function StrategyExplorer({
  explorer,
  loading,
  selectedCase,
  taxonomy,
  mainnet,
  onDraft,
  walrusRecall,
  walrusLoading,
  walrusQuery,
  onWalrusQueryChange,
  onSearchWalrus,
}: {
  explorer: StrategyExplorerView | null;
  loading: boolean;
  selectedCase: { categoryCode: string; subtype: string | null } | null;
  taxonomy: OrganizationIntelligenceView["taxonomy"];
  mainnet: OrganizationIntelligenceView["walrus"]["mainnet"];
  onDraft: (categoryCode: string, subtype: string) => void;
  walrusRecall: WalrusRecallView | null;
  walrusLoading: boolean;
  walrusQuery: string;
  onWalrusQueryChange: (value: string) => void;
  onSearchWalrus: () => void;
}) {
  const definition = useMemo(
    () =>
      selectedCase
        ? taxonomy.find((item) => item.code === selectedCase.categoryCode)
        : null,
    [selectedCase, taxonomy],
  );
  const [draftSubtype, setDraftSubtype] = useState(
    selectedCase?.subtype ?? definition?.subtypes[0]?.code ?? "",
  );

  if (!selectedCase) {
    return (
      <EmptyState
        title="Choose a case category"
        description="Open a category in the Case Library to compare strategies, outcomes and supporting cases."
      />
    );
  }

  if (loading && !explorer) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-8 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading case evidence…
      </div>
    );
  }

  if (!explorer) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              {explorer.categoryCode}
            </p>
            <h2 className="text-lg font-semibold">{explorer.categoryName}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {explorer.subtype ?? "All subtypes"}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Select
              value={draftSubtype}
              onChange={(event) => setDraftSubtype(event.target.value)}
              className="h-8 w-52 text-xs"
            >
              {definition?.subtypes.map((subtype) => (
                <option key={subtype.code} value={subtype.code}>
                  {subtype.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              onClick={() => onDraft(explorer.categoryCode, draftSubtype)}
              disabled={!draftSubtype}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Draft playbook
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <MiniStat label="Cases" value={explorer.totalCases} />
          <MiniStat label="Executions" value={explorer.totalExecutions} />
          <MiniStat label="Positive" value={explorer.positiveOutcomes} />
          <MiniStat label="Negative" value={explorer.negativeOutcomes} />
          <MiniStat label="Pending" value={explorer.pendingOutcomes} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Strategy evidence
            </h3>
            {explorer.strategies.length === 0 ? (
              <p className="mt-2 rounded-lg border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                No strategy execution has been recorded for this case yet.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {explorer.strategies.map((strategy) => (
                  <StrategyCard key={strategy.strategyId} strategy={strategy} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Supporting cases
            </h3>
            <div className="mt-2 space-y-2">
              {explorer.cases.map((caseInstance) => (
                <div
                  key={caseInstance.id}
                  className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue">{caseInstance.subtype}</Badge>
                    {caseInstance.dealStage ? (
                      <Badge tone="neutral">{caseInstance.dealStage}</Badge>
                    ) : null}
                    {caseInstance.severity ? (
                      <Badge
                        tone={
                          caseInstance.severity === "HIGH"
                            ? "red"
                            : caseInstance.severity === "MEDIUM"
                              ? "amber"
                              : "neutral"
                        }
                      >
                        {caseInstance.severity}
                      </Badge>
                    ) : null}
                    {caseInstance.isSynthetic ? (
                      <Badge tone="amber">Synthetic</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs font-medium">{caseInstance.description}</p>
                  {caseInstance.evidence ? (
                    <p className="mt-1 text-[11px] italic text-neutral-500 dark:text-neutral-400">
                      “{caseInstance.evidence}”
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                    <span>Call {caseInstance.callNumber}</span>
                    <span>·</span>
                    <span>{caseInstance.salespersonName ?? "Unknown rep"}</span>
                    <span>·</span>
                    <span>{formatDate(caseInstance.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from(new Set(caseInstance.strategies)).map(
                      (strategy) => (
                        <Badge key={strategy} tone="purple">
                          {strategy}
                        </Badge>
                      ),
                    )}
                    {Array.from(new Set(caseInstance.outcomes)).map(
                      (outcome) => (
                        <Badge key={outcome} tone={outcomeTone(outcome)}>
                          {outcome}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside>
          <WalrusRecallCard
            mainnet={mainnet}
            recall={walrusRecall}
            loading={walrusLoading}
            query={walrusQuery}
            onQueryChange={onWalrusQueryChange}
            onSearch={onSearchWalrus}
          />
        </aside>
      </div>
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: StrategyEvidenceView }) {
  const totalOutcomes =
    strategy.positive + strategy.negative + strategy.neutral;
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{strategy.name}</p>
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
            {strategy.typeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="blue">{confidenceLabel(strategy.confidence) ?? "No confidence"}</Badge>
          {strategy.isSynthetic ? <Badge tone="amber">Synthetic</Badge> : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <MiniStat label="Executions" value={strategy.executions} />
        <MiniStat label="Positive" value={strategy.positive} />
        <MiniStat label="Negative" value={strategy.negative} />
        <MiniStat label="Pending" value={strategy.pending} />
      </div>
      {totalOutcomes > 0 ? (
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <span
            className="bg-emerald-500"
            style={{ width: `${(strategy.positive / totalOutcomes) * 100}%` }}
          />
          <span
            className="bg-red-500"
            style={{ width: `${(strategy.negative / totalOutcomes) * 100}%` }}
          />
          <span
            className="bg-neutral-400"
            style={{ width: `${(strategy.neutral / totalOutcomes) * 100}%` }}
          />
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {strategy.outcomeBreakdown.map((item) => (
          <Badge key={item.outcomeType} tone={outcomeTone(item.outcomeType)}>
            {item.label} · {item.count}
          </Badge>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
        <span>{strategy.caseIds.length} cases</span>
        {strategy.contexts.length > 0 ? (
          <>
            <span>·</span>
            <span>Stages: {strategy.contexts.join(", ")}</span>
          </>
        ) : null}
        {strategy.lastEvaluatedAt ? (
          <>
            <span>·</span>
            <span>Last outcome {formatDate(strategy.lastEvaluatedAt)}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
      <p className="text-sm font-semibold leading-tight">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
    </div>
  );
}

function PlaybookList({
  playbooks,
  onApprove,
  onReject,
}: {
  playbooks: PlaybookView[];
  onApprove: (versionId: string) => void;
  onReject: (versionId: string) => void;
}) {
  if (playbooks.length === 0) {
    return (
      <EmptyState
        title="No playbooks yet"
        description="Generate a draft from the Strategy Explorer after enough evidence has accumulated. Drafts require review before publishing."
      />
    );
  }

  return (
    <div className="space-y-3">
      {playbooks.map((playbook) => {
        const latest = playbook.versions[0];
        const pending = playbook.versions.find(
          (version) => version.approvalStatus === "PENDING",
        );
        return (
          <div
            key={playbook.id}
            className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={PLAYBOOK_TONES[playbook.status] ?? "neutral"}>
                    {playbook.status}
                  </Badge>
                  <Badge tone="neutral">
                    {playbook.categoryName} · {playbook.subtype}
                  </Badge>
                  {playbook.isSynthetic ? (
                    <Badge tone="amber">Synthetic</Badge>
                  ) : null}
                </div>
                <h3 className="mt-2 text-sm font-semibold">{playbook.title}</h3>
                <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {playbook.description}
                </p>
              </div>
              <div className="text-right text-[10px] text-neutral-500 dark:text-neutral-400">
                <p>Version {playbook.currentVersion}</p>
                <p>Updated {formatDate(playbook.updatedAt)}</p>
              </div>
            </div>

            {latest ? (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">v{latest.version}</Badge>
                  <Badge tone={APPROVAL_TONES[latest.approvalStatus] ?? "neutral"}>
                    {latest.approvalStatus}
                  </Badge>
                  {latest.recommendedStrategy ? (
                    <Badge tone="purple">
                      {latest.recommendedStrategy.name}
                    </Badge>
                  ) : null}
                  {confidenceLabel(latest.confidence) ? (
                    <Badge tone="blue">
                      {confidenceLabel(latest.confidence)}
                    </Badge>
                  ) : null}
                  <Badge tone="neutral">
                    {latest.evidenceCount} evidence items
                  </Badge>
                </div>

                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">
                    Guidance
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {latest.guidance}
                  </p>
                </div>

                <details className="rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">
                  <summary className="cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
                    Conditions, exceptions and evidence summary
                  </summary>
                  <div className="mt-2 space-y-2 text-neutral-600 dark:text-neutral-400">
                    <p className="whitespace-pre-wrap">{latest.conditions}</p>
                    <p className="whitespace-pre-wrap">{latest.exceptions}</p>
                    <p className="whitespace-pre-wrap">{latest.evidenceSummary}</p>
                  </div>
                </details>

                {pending ? (
                  <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                    <Button
                      size="sm"
                      onClick={() => onApprove(pending.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve & publish to Walrus
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReject(pending.id)}
                    >
                      Reject draft
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {playbook.versions.length > 1 ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
                  Version history ({playbook.versions.length})
                </summary>
                <ol className="mt-2 space-y-1.5">
                  {playbook.versions.map((version) => (
                    <li
                      key={version.id}
                      className="rounded-md border border-neutral-200 px-3 py-2 text-[11px] dark:border-neutral-800"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="font-semibold">v{version.version}</span>
                        <Badge
                          tone={APPROVAL_TONES[version.approvalStatus] ?? "neutral"}
                        >
                          {version.approvalStatus}
                        </Badge>
                      </div>
                      <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                        {formatDateTime(version.createdAt)}
                        {version.approvedBy
                          ? ` · approved by ${version.approvedBy.name}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Insights({ insights }: { insights: LearningInsightView[] }) {
  if (insights.length === 0) {
    return (
      <EmptyState
        title="No learning insights yet"
        description="Insights appear after comparable case executions and outcomes are recorded."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="blue">
              {confidenceLabel(insight.confidence) ?? "Descriptive"}
            </Badge>
            <Badge tone="neutral">{insight.evidenceCount} evidence</Badge>
            {insight.isSynthetic ? (
              <Badge tone="amber">Synthetic</Badge>
            ) : null}
          </div>
          <h3 className="mt-2 text-sm font-semibold">{insight.title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            {insight.description}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[10px] font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
              Inspect evidence references
            </summary>
            <div className="mt-1 space-y-1 text-[10px] text-neutral-500 dark:text-neutral-400">
              {insight.evidenceCaseIds.slice(0, 8).map((id) => (
                <p key={id} className="font-mono">
                  case: {id}
                </p>
              ))}
              {insight.evidenceExecutionIds.slice(0, 8).map((id) => (
                <p key={id} className="font-mono">
                  execution: {id}
                </p>
              ))}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

function WalrusPanel({
  data,
  recall,
  query,
  loading,
  onQueryChange,
  onSearch,
  onRetry,
  onSyncPending,
  onSeed,
  seeding,
}: {
  data: OrganizationIntelligenceView;
  recall: WalrusRecallView | null;
  query: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onRetry: (syncId: string) => void;
  onSyncPending: () => void;
  onSeed: () => void;
  seeding: boolean;
}) {
  const { walrus } = data;
  const mainnet = walrus.mainnet;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total syncs" value={walrus.statusCounts.total} />
        <Stat label="Completed" value={walrus.statusCounts.completed} />
        <Stat label="Pending" value={walrus.statusCounts.pending} />
        <Stat label="Failed" value={walrus.statusCounts.failed} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Semantic recall</h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Query the organization and personal-learning namespaces.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onSyncPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sync pending
              </Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="e.g. migration risk with phased rollout"
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSearch();
                }}
              />
              <Button size="sm" onClick={onSearch} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                Recall
              </Button>
            </div>
            {recall ? (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  {recall.results.length} result(s) from{" "}
                  {recall.namespaces.join(", ")}
                </p>
                {recall.results.length === 0 ? (
                  <p className="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    No matching Walrus memories yet.
                  </p>
                ) : (
                  recall.results.map((result) => (
                    <div
                      key={`${result.blobId}-${result.namespace}`}
                      className="rounded-md border border-neutral-200 p-3 text-xs dark:border-neutral-800"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          tone={
                            result.memoryType === "PERSONAL_LEARNING"
                              ? "purple"
                              : "blue"
                          }
                        >
                          {result.memoryType === "PERSONAL_LEARNING"
                            ? "Personal learning"
                            : "Organization"}
                        </Badge>
                        <Badge tone="neutral">{result.namespace}</Badge>
                        <span className="text-[10px] text-neutral-400">
                          distance {result.distance.toFixed(3)}
                        </span>
                        <a
                          href={`${mainnet.walrusBlobBaseUrl}${result.blobId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto text-[10px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          View blob on Walruscan ↗
                        </a>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                        {result.text.slice(0, 900)}
                        {result.text.length > 900 ? "…" : ""}
                      </p>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                Run a recall to inspect what Walrus returns, including distance
                and namespace provenance.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-semibold">Recent Walrus writes</h3>
            <div className="mt-3 space-y-2">
              {walrus.recent.length === 0 ? (
                <p className="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  No Walrus writes yet. Load the synthetic demo or analyze a
                  call.
                </p>
              ) : (
                walrus.recent.map((sync) => (
                  <WalrusSyncRow
                    key={sync.id}
                    sync={sync}
                    mainnet={mainnet}
                    onRetry={onRetry}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Brain className="h-4 w-4 text-emerald-500" />
              Walrus feature map
            </h3>
            <ul className="mt-2 space-y-2 text-neutral-600 dark:text-neutral-400">
              <li>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  Case ingestion:
                </span>{" "}
                each identified case is written with{" "}
                <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
                  rememberAndWait
                </code>{" "}
                to <code>dealos_demo_organization</code>.
              </li>
              <li>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  Playbook publishing:
                </span>{" "}
                approved versions use{" "}
                <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
                  analyzeAndWait
                </code>{" "}
                so Walrus extracts durable guidance.
              </li>
              <li>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  Personal learning:
                </span>{" "}
                techniques use the{" "}
                <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
                  dealos_demo_learning
                </code>{" "}
                namespace.
              </li>
              <li>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  Semantic recall:
                </span>{" "}
                recommendations retrieve organization and personal memories.
              </li>
              <li>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  Independent status:
                </span>{" "}
                PostgreSQL writes and Walrus writes are tracked separately with
                retries.
              </li>
            </ul>
          </div>

          <TatumProofCard mainnet={mainnet} />

          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Mainnet verification
            </h3>
            <div className="mt-2 space-y-2">
              <a
                href={mainnet.walrusExplorerUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-2.5 py-2 font-medium text-neutral-700 transition hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
              >
                <span>Walruscan mainnet explorer</span>
                <span aria-hidden>↗</span>
              </a>
              {mainnet.memoryAccountId ? (
                <a
                  href={`${mainnet.suiObjectBaseUrl}${mainnet.memoryAccountId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-2.5 py-2 font-medium text-neutral-700 transition hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300"
                >
                  <span>Walrus Memory account object</span>
                  <span aria-hidden>↗</span>
                </a>
              ) : (
                <p className="rounded-md border border-dashed border-neutral-300 px-2 py-1.5 text-[10px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  MEMWAL_ACCOUNT_ID is not configured.
                </p>
              )}
              <p className="text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Blob links open the immutable Walrus storage object for each
                memory write. The account object link opens the Sui object that
                anchors the delegate account.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-semibold">Entity coverage</h3>
            <div className="mt-2 space-y-1.5">
              {walrus.entityCounts.length === 0 ? (
                <p className="text-neutral-500 dark:text-neutral-400">
                  No synced entities yet.
                </p>
              ) : (
                walrus.entityCounts.map((item) => (
                  <div
                    key={item.entityType}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-neutral-600 dark:text-neutral-400">
                      {item.entityType}
                    </span>
                    <Badge tone="neutral">{item.count}</Badge>
                  </div>
                ))
              )}
            </div>
            <h3 className="mt-4 text-sm font-semibold">Namespaces</h3>
            <div className="mt-2 space-y-1.5">
              {walrus.namespaceCounts.map((item) => (
                <div
                  key={item.namespace}
                  className="flex items-center justify-between gap-2"
                >
                  <code className="text-[10px] text-neutral-600 dark:text-neutral-400">
                    {item.namespace}
                  </code>
                  <Badge tone="neutral">{item.count}</Badge>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 w-full"
              onClick={onSeed}
              disabled={seeding}
            >
              {seeding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5" />
              )}
              Seed synthetic organizational memory
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function WalrusSyncRow({
  sync,
  mainnet,
  onRetry,
}: {
  sync: WalrusSyncEntryView;
  mainnet: OrganizationIntelligenceView["walrus"]["mainnet"];
  onRetry: (syncId: string) => void;
}) {
  const blobIds = collectBlobIds(sync.blobReferences);
  const owner = collectOwner(sync.blobReferences);
  return (
    <div className="rounded-md border border-neutral-200 p-3 text-xs dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={SYNC_TONES[sync.status] ?? "neutral"}>{sync.status}</Badge>
          <Badge tone="neutral">{sync.entityType}</Badge>
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            {sync.entityLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400">
            {sync.syncedAt ? formatDateTime(sync.syncedAt) : "Not synced"}
          </span>
          {sync.status === "FAILED" || sync.status === "PENDING" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRetry(sync.id)}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
        {sync.namespace} · attempts {sync.attempts}
      </p>
      {blobIds.length > 0 || owner ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
          {blobIds[0] ? (
            <a
              href={`${mainnet.walrusBlobBaseUrl}${blobIds[0]}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              View blob on Walruscan ↗
            </a>
          ) : null}
          {blobIds.length > 1 ? (
            <details>
              <summary className="cursor-pointer font-medium text-neutral-600 dark:text-neutral-400">
                {blobIds.length} blobs
              </summary>
              <div className="mt-1 space-y-0.5">
                {blobIds.slice(0, 25).map((blobId) => (
                  <a
                    key={blobId}
                    href={`${mainnet.walrusBlobBaseUrl}${blobId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-[9px] text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {blobId}
                  </a>
                ))}
              </div>
            </details>
          ) : null}
          {owner ? (
            <a
              href={`${mainnet.suiAccountBaseUrl}${owner}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-neutral-600 hover:underline dark:text-neutral-400"
            >
              Owner on Suiscan ↗
            </a>
          ) : null}
        </div>
      ) : null}
      {sync.errorMessage ? (
        <p className="mt-1 flex items-start gap-1.5 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-700 dark:text-red-400">
          <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          {sync.errorMessage}
        </p>
      ) : null}
      {sync.blobReferences ? (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
            Walrus references
          </summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-neutral-50 p-2 text-[9px] text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400">
            {JSON.stringify(sync.blobReferences, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function WalrusRecallCard({
  mainnet,
  recall,
  loading,
  query,
  onQueryChange,
  onSearch,
}: {
  mainnet: OrganizationIntelligenceView["walrus"]["mainnet"];
  recall: WalrusRecallView | null;
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Search className="h-4 w-4 text-emerald-500" />
        Walrus recall
      </h3>
      <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
        Retrieve semantically similar organizational cases and learning
        memories.
      </p>
      <div className="mt-3 flex gap-2">
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Ask about similar situations"
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
        />
        <Button size="sm" onClick={onSearch} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      {recall ? (
        <div className="mt-3 space-y-2">
          {recall.results.length === 0 ? (
            <p className="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              No matching memories.
            </p>
          ) : (
            recall.results.map((result) => (
              <div
                key={`${result.blobId}-${result.namespace}`}
                className="rounded-md border border-neutral-200 p-2.5 text-[11px] dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    tone={
                      result.memoryType === "PERSONAL_LEARNING"
                        ? "purple"
                        : "blue"
                    }
                  >
                    {result.memoryType === "PERSONAL_LEARNING"
                      ? "Personal"
                      : "Org"}
                  </Badge>
                  <span className="text-[9px] text-neutral-400">
                    {result.distance.toFixed(3)}
                  </span>
                  <a
                    href={`${mainnet.walrusBlobBaseUrl}${result.blobId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-[9px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    Mainnet blob ↗
                  </a>
                </div>
                <p className="mt-1 leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {result.text.slice(0, 420)}
                  {result.text.length > 420 ? "…" : ""}
                </p>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function TatumProofCard({
  mainnet,
}: {
  mainnet: OrganizationIntelligenceView["walrus"]["mainnet"];
}) {
  const [proof, setProof] = useState<{
    chainIdentifier?: string;
    latestCheckpoint?: string;
    checkedAt?: string;
    provider?: string;
    account?: {
      objectId?: string;
      found?: boolean;
      type?: string;
      owner?: string;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProof = useCallback(async () => {
    try {
      const response = await fetch("/api/organization/mainnet-proof", {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(
          body?.error?.message ?? "Tatum mainnet proof is unavailable.",
        );
        return;
      }
      setProof(await response.json());
    } catch {
      setError("Tatum mainnet proof is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Link2 className="h-4 w-4 text-emerald-500" />
          Tatum mainnet proof
        </h3>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError(null);
            void fetchProof();
          }}
          disabled={loading}
          className="text-[10px] font-medium text-neutral-500 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          {loading ? "Checking…" : proof ? "Recheck" : "Verify onchain"}
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
        {proof
          ? `Live reads through ${proof.provider ?? "Tatum Sui Mainnet RPC"}.`
          : "Click Verify onchain to read Sui mainnet through Tatum RPC."}
      </p>
      {error ? (
        <p className="mt-2 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {proof ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-500 dark:text-neutral-400">
              Chain identifier
            </span>
            <span className="font-mono text-[10px] font-medium text-neutral-800 dark:text-neutral-200">
              {proof.chainIdentifier ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-500 dark:text-neutral-400">
              Latest checkpoint
            </span>
            <span className="font-mono text-[10px] font-medium text-neutral-800 dark:text-neutral-200">
              {proof.latestCheckpoint ?? "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-500 dark:text-neutral-400">
              Memory account
            </span>
            <span className="font-mono text-[10px] text-neutral-800 dark:text-neutral-200">
              {proof.account?.found ? "found on Sui" : "not found / unset"}
            </span>
          </div>
          {proof.account?.objectId ? (
            <a
              href={`${mainnet.suiObjectBaseUrl}${proof.account.objectId}`}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-[10px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {proof.account.objectId}
            </a>
          ) : null}
          {proof.account?.type ? (
            <p className="break-all text-[9px] text-neutral-500 dark:text-neutral-400">
              {proof.account.type}
            </p>
          ) : null}
          {proof.checkedAt ? (
            <p className="text-[9px] text-neutral-400">
              Checked {formatDateTime(proof.checkedAt)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <BookOpen className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
