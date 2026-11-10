"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  Input,
  Label,
  Textarea,
} from "@/components/ui/form";
import { formatDateTime } from "@/lib/display";
import { getErrorMessage } from "@/lib/client-api";
import type {
  PersonalTechniqueView,
  WalrusRecallView,
  WalrusStatusView,
} from "@/types/organization";

const SYNC_TONES: Record<string, Tone> = {
  COMPLETED: "green",
  FAILED: "red",
  PENDING: "amber",
  PROCESSING: "amber",
};

export function MyLearning({
  organizationName,
  initialTechniques,
  initialWalrus,
}: {
  organizationName: string;
  initialTechniques: PersonalTechniqueView[];
  initialWalrus: WalrusStatusView;
}) {
  const [techniques, setTechniques] = useState(initialTechniques);
  const [walrus, setWalrus] = useState(initialWalrus);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [recall, setRecall] = useState<WalrusRecallView | null>(null);
  const [recallLoading, setRecallLoading] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [techniquesResponse, walrusResponse] = await Promise.all([
        fetch("/api/learning/techniques", { cache: "no-store" }),
        fetch("/api/organization/walrus", { cache: "no-store" }),
      ]);
      if (techniquesResponse.ok) {
        const body = (await techniquesResponse.json()) as {
          techniques: PersonalTechniqueView[];
        };
        setTechniques(body.techniques);
      }
      if (walrusResponse.ok) {
        const body = (await walrusResponse.json()) as {
          status: WalrusStatusView;
        };
        setWalrus(body.status);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/learning/techniques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          source: source || undefined,
        }),
      });
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      setName("");
      setDescription("");
      setSource("");
      await refresh();
    } catch {
      setError("Unable to save the technique.");
    } finally {
      setSaving(false);
    }
  }

  async function retry(techniqueId: string) {
    try {
      await fetch(`/api/learning/techniques/${techniqueId}/sync`, {
        method: "POST",
      });
      await refresh();
    } catch {
      setError("Unable to retry the Walrus sync.");
    }
  }

  async function search() {
    if (query.trim().length < 2) return;
    setRecallLoading(true);
    try {
      const response = await fetch(
        `/api/organization/walrus?query=${encodeURIComponent(query)}`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const body = (await response.json()) as {
          recall: WalrusRecallView | null;
        };
        setRecall(body.recall);
      }
    } finally {
      setRecallLoading(false);
    }
  }

  const personalResults =
    recall?.results.filter(
      (result) => result.memoryType === "PERSONAL_LEARNING",
    ) ?? [];
  const organizationResults =
    recall?.results.filter(
      (result) => result.memoryType === "ORGANIZATION",
    ) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>DealOS</span>
            <span>/</span>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              My Learning
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Personal learning memory
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Capture techniques you learn from books, videos and experience.
            Personal learning is stored in the{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">
              dealos_demo_learning
            </code>{" "}
            Walrus namespace and stays separate from shared organizational
            playbooks.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="purple">
              <BookOpen className="h-3 w-3" />
              {organizationName}
            </Badge>
            <Badge tone="neutral">{techniques.length} techniques</Badge>
          </div>
        </div>
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
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Techniques" value={techniques.length} />
        <Stat label="Walrus synced" value={walrus.statusCounts.completed} />
        <Stat label="Pending" value={walrus.statusCounts.pending} />
        <Stat label="Failed" value={walrus.statusCounts.failed} />
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold">Add a technique</h2>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              The technique is saved to PostgreSQL and written to Walrus
              learning memory. Sync status is tracked independently.
            </p>
            <form onSubmit={onSubmit} className="mt-3 space-y-3">
              <div>
                <Label htmlFor="learning-name">Technique name</Label>
                <Input
                  id="learning-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ROI-first discovery"
                  maxLength={200}
                  required
                />
              </div>
              <div>
                <Label htmlFor="learning-description">What you learned</Label>
                <Textarea
                  id="learning-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ask for the operational cost before defending price."
                  maxLength={4_000}
                  required
                  className="min-h-24"
                />
              </div>
              <div>
                <Label htmlFor="learning-source">Source (optional)</Label>
                <Input
                  id="learning-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="Book, video, course or personal experience"
                  maxLength={300}
                />
              </div>
              {error ? <FieldError>{error}</FieldError> : null}
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Save to personal learning
              </Button>
            </form>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Your techniques
            </h2>
            {techniques.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                No personal techniques yet. Add one to start building your
                learning memory.
              </p>
            ) : (
              techniques.map((technique) => (
                <div
                  key={technique.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">{technique.name}</h3>
                      <p className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                        {technique.source ?? "Self-recorded"} ·{" "}
                        {formatDateTime(technique.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {technique.walrusStatus ? (
                        <Badge
                          tone={SYNC_TONES[technique.walrusStatus] ?? "neutral"}
                        >
                          {technique.walrusStatus === "COMPLETED" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : technique.walrusStatus === "FAILED" ? (
                            <CircleAlert className="h-3 w-3" />
                          ) : (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          Walrus {technique.walrusStatus.toLowerCase()}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Not synced</Badge>
                      )}
                      {technique.dealId ? (
                        <Badge tone="blue">Deal technique</Badge>
                      ) : (
                        <Badge tone="purple">Personal</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                    {technique.description}
                  </p>
                  {technique.walrusError ? (
                    <p className="mt-2 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-700 dark:text-red-400">
                      {technique.walrusError}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
                    <span>
                      {technique.walrusSyncedAt
                        ? `Synced ${formatDateTime(technique.walrusSyncedAt)}`
                        : "Awaiting Walrus sync"}
                    </span>
                    {technique.walrusStatus === "FAILED" ||
                    technique.walrusStatus === "PENDING" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void retry(technique.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry sync
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Search className="h-4 w-4 text-emerald-500" />
              Recall learning memory
            </h3>
            <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
              Search your personal techniques and the organization namespace
              through Walrus semantic recall.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. handling budget objections"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void search();
                }}
              />
              <Button size="sm" onClick={() => void search()} disabled={recallLoading}>
                {recallLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            {recall ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Personal learning
                  </p>
                  {personalResults.length === 0 ? (
                    <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      No personal matches.
                    </p>
                  ) : (
                    personalResults.map((result) => (
                      <RecallRow
                        key={`${result.blobId}-${result.namespace}`}
                        text={result.text}
                        distance={result.distance}
                        namespace={result.namespace}
                        blobId={result.blobId}
                        mainnet={walrus.mainnet}
                      />
                    ))
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Organization context
                  </p>
                  {organizationResults.length === 0 ? (
                    <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                      No organizational matches.
                    </p>
                  ) : (
                    organizationResults.map((result) => (
                      <RecallRow
                        key={`${result.blobId}-${result.namespace}`}
                        text={result.text}
                        distance={result.distance}
                        namespace={result.namespace}
                        blobId={result.blobId}
                        mainnet={walrus.mainnet}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Database className="h-4 w-4 text-emerald-500" />
              Walrus learning status
            </h3>
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
            <p className="mt-3 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              Personal learning is private to the salesperson. Organization
              playbooks only receive de-identified, approved guidance.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RecallRow({
  text,
  distance,
  namespace,
  blobId,
  mainnet,
}: {
  text: string;
  distance: number;
  namespace: string;
  blobId: string;
  mainnet: WalrusStatusView["mainnet"];
}) {
  return (
    <div className="mt-1.5 rounded-md border border-neutral-200 p-2 text-[11px] dark:border-neutral-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-neutral-400">{namespace}</span>
        <span className="text-[9px] text-neutral-400">
          {distance.toFixed(3)}
        </span>
        <a
          href={`${mainnet.walrusBlobBaseUrl}${blobId}`}
          target="_blank"
          rel="noreferrer"
          className="text-[9px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Mainnet blob ↗
        </a>
      </div>
      <p className="mt-1 leading-relaxed text-neutral-600 dark:text-neutral-400">
        {text.slice(0, 420)}
        {text.length > 420 ? "…" : ""}
      </p>
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
