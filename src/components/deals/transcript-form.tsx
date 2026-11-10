"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
  Textarea,
} from "@/components/ui/form";
import { getErrorMessage } from "@/lib/client-api";
import type { CallDetail } from "@/types/deal";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "processing"; callNumber: number; status: string }
  | { kind: "completed"; callNumber: number }
  | { kind: "analysis_failed"; callNumber: number; message: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function TranscriptForm({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({
    transcript: "",
    title: "",
    callDate: "",
  });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  async function pollCall(callId: string, callNumber: number) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await sleep(2_000);
      try {
        const response = await fetch(`/api/calls/${callId}`, {
          cache: "no-store",
        });
        if (!response.ok) continue;

        const body = (await response.json()) as { call: CallDetail };
        const status = body.call.analysisStatus;

        if (status === "COMPLETED") {
          setPhase({ kind: "completed", callNumber });
          setForm({ transcript: "", title: "", callDate: "" });
          router.refresh();
          return;
        }

        if (status === "FAILED") {
          setPhase({
            kind: "analysis_failed",
            callNumber,
            message: body.call.analysisError ?? "Analysis failed.",
          });
          router.refresh();
          return;
        }

        setPhase({ kind: "processing", callNumber, status });
      } catch {
        // Keep polling through transient network errors.
      }
    }

    setPhase({
      kind: "analysis_failed",
      callNumber,
      message: "Analysis is taking longer than expected. Refresh to check.",
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPhase({ kind: "uploading" });

    try {
      const response = await fetch(`/api/deals/${dealId}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: form.transcript,
          title: form.title || undefined,
          callDate: form.callDate || undefined,
        }),
      });

      if (!response.ok) {
        setError(await getErrorMessage(response));
        setPhase({ kind: "idle" });
        return;
      }

      const body = (await response.json()) as {
        call: { id: string; callNumber: number };
      };

      setPhase({
        kind: "processing",
        callNumber: body.call.callNumber,
        status: "PENDING",
      });
      router.refresh();
      void pollCall(body.call.id, body.call.callNumber);
    } catch {
      setError("Unable to submit the transcript. Please try again.");
      setPhase({ kind: "idle" });
    }
  }

  const busy = phase.kind === "uploading" || phase.kind === "processing";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit a call transcript</CardTitle>
        <CardDescription>
          Add a synthetic sales conversation. Nemotron extracts facts, then
          Walrus Memory stores the useful experiences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="call-title">Call title</Label>
              <Input
                id="call-title"
                value={form.title}
                maxLength={200}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Discovery call"
              />
            </div>
            <div>
              <Label htmlFor="call-date">Call date</Label>
              <Input
                id="call-date"
                type="date"
                value={form.callDate}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, callDate: event.target.value }))
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="transcript">Transcript</Label>
            <Textarea
              id="transcript"
              value={form.transcript}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, transcript: event.target.value }))
              }
              placeholder="Paste the sales call transcript here. Use synthetic data only."
              minLength={20}
              maxLength={50_000}
              required
              className="min-h-48"
            />
            <FieldHint>
              {form.transcript.length.toLocaleString()} / 50,000 characters.
              Empty and oversized transcripts are rejected.
            </FieldHint>
          </div>

          {error ? <FieldError>{error}</FieldError> : null}

          <StatusPanel phase={phase} />

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {phase.kind === "uploading"
              ? "Uploading..."
              : phase.kind === "processing"
                ? "Analyzing transcript..."
                : "Submit transcript"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function StatusPanel({ phase }: { phase: Phase }) {
  if (phase.kind === "idle") return null;

  if (phase.kind === "uploading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving the transcript to PostgreSQL...
      </div>
    );
  }

  if (phase.kind === "processing") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" />
        <span>
          Call {phase.callNumber} saved. Nemotron is analyzing the transcript
          and the result will be persisted before Walrus memory sync begins.
        </span>
      </div>
    );
  }

  if (phase.kind === "completed") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
        <Sparkles className="mt-0.5 h-3.5 w-3.5" />
        <span>
          Call {phase.callNumber} analyzed and saved to PostgreSQL. Walrus
          memory sync continues in the background; the call page shows its
          independent status.
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
      Call {phase.callNumber}: {phase.message}
    </div>
  );
}
