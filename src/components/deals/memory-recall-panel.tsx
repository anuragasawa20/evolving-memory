"use client";

import { useState, type FormEvent } from "react";
import { Brain, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/form";
import { getErrorMessage } from "@/lib/client-api";
import type { RecallResponse } from "@/types/deal";

export function MemoryRecallPanel({ dealId }: { dealId: string }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecallResponse | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/deals/${dealId}/memories?query=${encodeURIComponent(query)}&limit=5`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      setResult((await response.json()) as RecallResponse);
    } catch {
      setError("Unable to recall Walrus memories.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-neutral-500" />
          Recall from Walrus
        </CardTitle>
        <CardDescription>
          Search deal-scoped experiences persisted on Walrus Memory Mainnet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="recall-query">Question</Label>
            <Input
              id="recall-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What are the customer's main objections?"
              minLength={2}
              maxLength={500}
              required
            />
            <FieldHint>
              The query is automatically scoped to this deal ID.
            </FieldHint>
          </div>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {loading ? "Searching Walrus..." : "Recall memories"}
          </Button>
        </form>

        {error ? <FieldError className="mt-3">{error}</FieldError> : null}

        {result ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {result.results.length} remembered{" "}
              {result.results.length === 1 ? "experience" : "experiences"}
            </p>
            {result.results.length === 0 ? (
              <p className="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                No matching memories yet. Completed Walrus syncs are searchable
                here.
              </p>
            ) : (
              result.results.map((memory) => (
                <div
                  key={memory.blobId}
                  className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950"
                >
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {memory.text}
                  </p>
                  <p className="mt-2 text-[10px] text-neutral-400">
                    distance {memory.distance.toFixed(3)} · blob{" "}
                    {memory.blobId.slice(0, 12)}...
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
