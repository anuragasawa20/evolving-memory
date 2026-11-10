"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldHint,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui/form";
import { getErrorMessage } from "@/lib/client-api";

export interface TechniqueMemoryOption {
  id: string;
  label: string;
  content: string;
}

export function TechniqueForm({
  dealId,
  memories,
  onCreated,
}: {
  dealId: string;
  memories: TechniqueMemoryOption[];
  onCreated: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [memoryId, setMemoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${dealId}/techniques`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          source: source || undefined,
          memoryId: memoryId || undefined,
        }),
      });
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      setName("");
      setDescription("");
      setSource("");
      setMemoryId("");
      setOpen(false);
      await onCreated();
    } catch {
      setError("Unable to save the technique.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4 text-violet-500" />
          Add personal technique
        </span>
        <Plus
          className={`h-4 w-4 text-neutral-400 transition ${open ? "rotate-45" : ""}`}
        />
      </button>

      {open ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800"
        >
          <div>
            <Label htmlFor="technique-name">Name</Label>
            <Input
              id="technique-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ROI-first discovery"
              maxLength={200}
              required
            />
          </div>
          <div>
            <Label htmlFor="technique-description">What you learned</Label>
            <Textarea
              id="technique-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ask for the operational cost before defending price."
              maxLength={4_000}
              required
              className="min-h-20"
            />
          </div>
          <div>
            <Label htmlFor="technique-source">Source (optional)</Label>
            <Input
              id="technique-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Book, video, or personal experience"
              maxLength={300}
            />
          </div>
          <div>
            <Label htmlFor="technique-memory">Addresses a memory (optional)</Label>
            <Select
              id="technique-memory"
              value={memoryId}
              onChange={(event) => setMemoryId(event.target.value)}
            >
              <option value="">No specific memory</option>
              {memories.map((memory) => (
                <option key={memory.id} value={memory.id}>
                  {memory.label}: {memory.content.slice(0, 60)}
                </option>
              ))}
            </Select>
            <FieldHint>
              Linking a technique records an ADDRESSES relationship in the graph.
            </FieldHint>
          </div>

          {error ? <FieldError>{error}</FieldError> : null}

          <Button type="submit" disabled={loading} size="sm" className="w-full">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Save technique
          </Button>
        </form>
      ) : null}
    </div>
  );
}
