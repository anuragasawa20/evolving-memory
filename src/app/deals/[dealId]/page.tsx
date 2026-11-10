import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CalendarClock,
  CircleDot,
  Loader2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { AutoRefresh } from "@/components/deals/auto-refresh";
import {
  MemoryRetryButton,
  ReanalyzeButton,
} from "@/components/deals/call-actions";
import { DealStageControl } from "@/components/deals/deal-stage-control";
import { FactList } from "@/components/deals/fact-list";
import { MemoryRecallPanel } from "@/components/deals/memory-recall-panel";
import { TranscriptForm } from "@/components/deals/transcript-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ANALYSIS_LABELS,
  ANALYSIS_TONES,
  MEMORY_LABELS,
  MEMORY_TONES,
  STAGE_LABELS,
  STAGE_TONES,
  STATUS_TONES,
  formatDate,
  formatDateTime,
} from "@/lib/display";
import { getDealWorkspace } from "@/services/deal.service";

export const instant = false;

interface PageProps {
  params: Promise<{ dealId: string }>;
}

export default async function DealWorkspacePage({ params }: PageProps) {
  await connection();
  const { dealId } = await params;
  const deal = await getDealWorkspace(dealId);
  if (!deal) notFound();

  const active = deal.calls.some(
    (call) =>
      call.analysisStatus === "PENDING" ||
      call.analysisStatus === "PROCESSING" ||
      call.memorySync?.status === "PENDING" ||
      call.memorySync?.status === "PROCESSING",
  );

  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <AutoRefresh active={active} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Link
          href="/deals"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All deals
        </Link>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STAGE_TONES[deal.stage]}>
                  {STAGE_LABELS[deal.stage]}
                </Badge>
                <Badge tone={STATUS_TONES[deal.status]}>
                  {deal.status}
                </Badge>
                {deal.isSynthetic ? (
                  <Badge tone="amber">Synthetic demo</Badge>
                ) : null}
                {active ? (
                  <Badge tone="amber">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing
                  </Badge>
                ) : null}
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                {deal.customerName}
              </h1>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {deal.productName}
              </p>
              {deal.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                  {deal.description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Created {formatDate(deal.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquareText className="h-3.5 w-3.5" />
                {deal.calls.length} {deal.calls.length === 1 ? "call" : "calls"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                {deal.memorySummary.completed} remembered on Walrus
              </span>
              <Link
                href={`/deals/${deal.id}/memory`}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Open Memory Explorer
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Deal state</CardTitle>
                <CardDescription>
                  The salesperson owns stage changes. Nemotron suggestions are
                  stored separately per call.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DealStageControl
                  dealId={deal.id}
                  stage={deal.stage}
                  status={deal.status}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Call timeline</CardTitle>
                  <CardDescription>
                    PostgreSQL persistence and Walrus memory are tracked
                    independently.
                  </CardDescription>
                </div>
                <Badge tone="neutral">{deal.calls.length} total</Badge>
              </CardHeader>
              <CardContent>
                {deal.calls.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    No calls yet. Submit the first transcript to start
                    analysis.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {deal.calls.map((call, index) => (
                      <li key={call.id} className="relative">
                        {index < deal.calls.length - 1 ? (
                          <span className="absolute left-[15px] top-9 h-[calc(100%+12px)] w-px bg-neutral-200 dark:bg-neutral-800" />
                        ) : null}
                        <div className="flex gap-3">
                          <span className="relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-[11px] font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                            {call.callNumber}
                          </span>
                          <div className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <Link
                                  href={`/deals/${deal.id}/calls/${call.id}`}
                                  className="text-sm font-semibold text-neutral-900 hover:underline dark:text-neutral-100"
                                >
                                  Call {call.callNumber}
                                  {call.title ? ` - ${call.title}` : ""}
                                </Link>
                                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                                  {formatDateTime(call.callDate ?? call.createdAt)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  tone={ANALYSIS_TONES[call.analysisStatus]}
                                >
                                  {ANALYSIS_LABELS[call.analysisStatus]}
                                </Badge>
                                {call.memorySync ? (
                                  <Badge
                                    tone={MEMORY_TONES[call.memorySync.status]}
                                  >
                                    {MEMORY_LABELS[call.memorySync.status]}
                                  </Badge>
                                ) : (
                                  <Badge tone="neutral">No Walrus sync</Badge>
                                )}
                              </div>
                            </div>

                            {call.summary ? (
                              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                                {call.summary}
                              </p>
                            ) : call.analysisStatus === "FAILED" ? (
                              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                {call.analysisError ??
                                  "The analysis did not complete."}
                              </p>
                            ) : (
                              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Analysis in progress
                              </p>
                            )}

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                              <Link
                                href={`/deals/${deal.id}/calls/${call.id}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-700 hover:gap-1.5 hover:underline dark:text-neutral-300"
                              >
                                Open call details
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                              <div className="flex flex-wrap gap-2">
                                {call.analysisStatus === "FAILED" ? (
                                  <ReanalyzeButton callId={call.id} />
                                ) : null}
                                {call.memorySync?.status === "FAILED" ? (
                                  <MemoryRetryButton callId={call.id} />
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extracted customer facts</CardTitle>
                <CardDescription>
                  Facts from every call in this deal, with supporting evidence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FactList facts={deal.facts} showSource />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <TranscriptForm dealId={deal.id} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-neutral-500" />
                  Walrus memory status
                </CardTitle>
                <CardDescription>
                  Conversations with Walrus Memory Mainnet in the{" "}
                  <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px] dark:bg-neutral-800">
                    dealos_demo_deals
                  </code>{" "}
                  namespace.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <MemoryStat
                    label="Synced"
                    value={deal.memorySummary.completed}
                    tone="text-emerald-600 dark:text-emerald-400"
                  />
                  <MemoryStat
                    label="Pending"
                    value={deal.memorySummary.pending}
                    tone="text-amber-600 dark:text-amber-400"
                  />
                  <MemoryStat
                    label="Failed"
                    value={deal.memorySummary.failed}
                    tone="text-red-600 dark:text-red-400"
                  />
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  <CircleDot className="mt-0.5 h-3 w-3 shrink-0" />
                  A PostgreSQL transaction is not treated as a Walrus success.
                  MemorySync only becomes completed after the SDK confirms all
                  extracted facts were persisted.
                </p>
              </CardContent>
            </Card>

            <MemoryRecallPanel dealId={deal.id} />

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              <p className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
                <Sparkles className="h-3.5 w-3.5" />
                Three memory layers
              </p>
              <p className="mt-1">
                This workspace is the deal-memory layer. Personal learning and
                organizational intelligence are available from the top
                navigation, and the Memory Explorer connects them to
                evidence-backed recommendations.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function MemoryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 py-3 dark:border-neutral-800">
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
    </div>
  );
}
