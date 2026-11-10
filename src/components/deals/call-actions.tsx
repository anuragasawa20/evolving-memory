"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/form";
import { getErrorMessage } from "@/lib/client-api";

export function MemoryRetryButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/calls/${callId}/memory-sync/retry`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      const body = (await response.json()) as {
        memorySync: { status: string; errorMessage?: string };
      };
      if (body.memorySync.status === "FAILED") {
        setError(body.memorySync.errorMessage ?? "Walrus sync failed again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to retry the Walrus sync.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" onClick={retry} disabled={loading}>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {loading ? "Retrying..." : "Retry Walrus sync"}
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

export function ReanalyzeButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/calls/${callId}/reanalyze`, {
        method: "POST",
      });
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to retry the analysis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" onClick={retry} disabled={loading}>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {loading ? "Retrying..." : "Retry analysis"}
      </Button>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
