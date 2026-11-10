"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError, Label, Select } from "@/components/ui/form";
import { DEAL_STAGES, DEAL_STATUSES } from "@/lib/validation";
import { STAGE_LABELS } from "@/lib/display";
import { getErrorMessage } from "@/lib/client-api";
import type { DealStage, DealStatus } from "@/types/deal";

export function DealStageControl({
  dealId,
  stage: initialStage,
  status: initialStatus,
}: {
  dealId: string;
  stage: DealStage;
  status: DealStatus;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<DealStage>(initialStage);
  const [status, setStatus] = useState<DealStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = stage !== initialStage || status !== initialStatus;

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, status }),
      });
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Unable to save the deal stage.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="deal-stage">Stage</Label>
          <Select
            id="deal-stage"
            value={stage}
            onChange={(event) => {
              setStage(event.target.value as DealStage);
              setSaved(false);
            }}
          >
            {DEAL_STAGES.map((value) => (
              <option key={value} value={value}>
                {STAGE_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="deal-status">Status</Label>
          <Select
            id="deal-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as DealStatus);
              setSaved(false);
            }}
          >
            {DEAL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving || !dirty}>
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {saving ? "Saving..." : "Update deal"}
        </Button>
        {saved ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Stage updated
          </span>
        ) : (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Only you update the deal stage. Nemotron suggestions are advisory.
          </span>
        )}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
