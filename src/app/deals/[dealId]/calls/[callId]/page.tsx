import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Brain,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { AutoRefresh } from "@/components/deals/auto-refresh";
import {
  MemoryRetryButton,
  ReanalyzeButton,
} from "@/components/deals/call-actions";
import { FactList } from "@/components/deals/fact-list";
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
  formatDate,
  formatDateTime,
} from "@/lib/display";
import { getCallById } from "@/services/call.service";

export const instant = false;

interface PageProps {
  params: Promise<{ dealId: string; callId: string }>;
}

export default async function CallDetailPage({ params }: PageProps) {
  await connection();
  const { dealId, callId } = await params;
  const call = await getCallById(callId);
  if (!call || call.dealId !== dealId) notFound();

  const syncActive =
    call.memorySync?.status === "PENDING" ||
    call.memorySync?.status === "PROCESSING";
  const analysisActive =
    call.analysisStatus === "PENDING" || call.analysisStatus === "PROCESSING";

  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <AutoRefresh active={analysisActive || syncActive} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Link
          href={`/deals/${dealId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {call.deal.customerName}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={ANALYSIS_TONES[call.analysisStatus]}>
                {ANALYSIS_LABELS[call.analysisStatus]}
              </Badge>
              {call.memorySync ? (
                <Badge tone={MEMORY_TONES[call.memorySync.status]}>
                  {MEMORY_LABELS[call.memorySync.status]}
                </Badge>
              ) : (
                <Badge tone="neutral">No Walrus sync</Badge>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">
              Call {call.callNumber}
              {call.title ? ` - ${call.title}` : ""}
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {call.deal.customerName} · {call.deal.productName}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDateTime(call.callDate ?? call.createdAt)}
            </span>
            <Link
              href={`/deals/${dealId}`}
              className="font-medium text-neutral-700 hover:underline dark:text-neutral-300"
            >
              Open deal workspace
            </Link>
          </div>
        </div>

        {analysisActive ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Nemotron is analyzing this call. Structured facts will appear here
            when the PostgreSQL transaction completes.
          </div>
        ) : null}

        {call.analysisStatus === "FAILED" ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
              <CircleAlert className="h-4 w-4" />
              Analysis failed
            </p>
            <p className="mt-1 text-xs text-red-700/90 dark:text-red-400/90">
              {call.analysisError ??
                "The model response could not be validated. No fabricated facts were saved."}
            </p>
            <div className="mt-3">
              <ReanalyzeButton callId={call.id} />
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Call summary</CardTitle>
                <CardDescription>
                  Generated from the transcript after Zod validation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {call.summary ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {call.summary}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {analysisActive
                      ? "Summary will appear when analysis completes."
                      : "No summary is available."}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Extracted facts</CardTitle>
                <CardDescription>
                  Each fact preserves its category and supporting transcript
                  evidence.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FactList facts={call.facts} />
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-neutral-500" />
                  Stage suggestion
                </CardTitle>
                <CardDescription>
                  Advisory only. The current deal stage is changed manually by
                  the salesperson.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Current stage
                  </span>
                  <Badge tone={STAGE_TONES[call.deal.stage]}>
                    {STAGE_LABELS[call.deal.stage]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-500 dark:text-neutral-400">
                    Suggested stage
                  </span>
                  {call.suggestedStage ? (
                    <Badge tone={STAGE_TONES[call.suggestedStage]}>
                      {STAGE_LABELS[call.suggestedStage]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-neutral-400">None</span>
                  )}
                </div>
                {call.stageReasoning ? (
                  <p className="rounded-md bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400">
                    {call.stageReasoning}
                  </p>
                ) : null}
                {call.suggestedStage &&
                call.suggestedStage !== call.deal.stage ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Suggestion differs from the current stage. Review it in the
                    deal workspace before making any change.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-neutral-500" />
                  Walrus synchronization
                </CardTitle>
                <CardDescription>
                  Separate from PostgreSQL persistence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {call.memorySync ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">
                        Status
                      </span>
                      <Badge tone={MEMORY_TONES[call.memorySync.status]}>
                        {call.memorySync.status === "COMPLETED" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : call.memorySync.status === "FAILED" ? (
                          <CircleAlert className="h-3 w-3" />
                        ) : (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {MEMORY_LABELS[call.memorySync.status]}
                      </Badge>
                    </div>
                    <dl className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-neutral-500 dark:text-neutral-400">
                          Namespace
                        </dt>
                        <dd className="font-mono text-neutral-700 dark:text-neutral-300">
                          {call.memorySync.namespace}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-neutral-500 dark:text-neutral-400">
                          Attempts
                        </dt>
                        <dd className="text-neutral-700 dark:text-neutral-300">
                          {call.memorySync.attempts}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-neutral-500 dark:text-neutral-400">
                          Synced at
                        </dt>
                        <dd className="text-neutral-700 dark:text-neutral-300">
                          {call.memorySync.syncedAt
                            ? formatDateTime(call.memorySync.syncedAt)
                            : "Not yet"}
                        </dd>
                      </div>
                    </dl>

                    {call.memorySync.errorMessage ? (
                      <p className="rounded-md border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-400">
                        {call.memorySync.errorMessage}
                      </p>
                    ) : null}

                    {call.memorySync.jobReferences ? (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
                          View Walrus job references
                        </summary>
                        <pre className="mt-2 max-h-56 overflow-auto rounded-md bg-neutral-50 p-2 text-[10px] leading-relaxed text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400">
                          {JSON.stringify(
                            call.memorySync.jobReferences,
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ) : null}

                    {call.memorySync.status === "FAILED" ? (
                      <MemoryRetryButton callId={call.id} />
                    ) : null}
                  </>
                ) : (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    MemorySync is created after the call analysis transaction
                    succeeds.
                  </p>
                )}

                <p className="border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  Last activity {formatDate(call.createdAt)}. Completed memories
                  can be recalled from the deal workspace.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
