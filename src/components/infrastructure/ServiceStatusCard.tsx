"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ConnectionTestButton } from "./ConnectionTestButton";
import type { ServiceStatus } from "@/types/infrastructure";

export type CardStatus = ServiceStatus | "idle";

const STATUS_META: Record<
  CardStatus,
  { label: string; badge: string; dot: string }
> = {
  connected: {
    label: "Connected",
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  disconnected: {
    label: "Disconnected",
    badge: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    dot: "bg-red-500",
  },
  configuration_missing: {
    label: "Configuration missing",
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  test_failed: {
    label: "Test failed",
    badge: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  idle: {
    label: "Not tested",
    badge: "border-neutral-400/30 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
    dot: "bg-neutral-400",
  },
};

export interface ServiceStatusCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  status: CardStatus;
  message?: string;
  error?: { code: string; message: string } | null;
  details?: unknown;
  checkedAt?: string;
  durationMs?: number;
  loading: boolean;
  onTest: () => void;
  testLabel: string;
  note?: string;
}

export function ServiceStatusCard({
  title,
  description,
  icon,
  status,
  message,
  error,
  details,
  checkedAt,
  durationMs,
  loading,
  onTest,
  testLabel,
  note,
}: ServiceStatusCardProps) {
  const meta = STATUS_META[status];

  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
            meta.badge,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
      </div>

      <div className="mt-4 flex-1 space-y-2">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          {message ?? "No status yet."}
        </p>

        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            <span className="font-semibold">{error.code}:</span> {error.message}
          </p>
        ) : null}

        {note ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{note}</p>
        ) : null}

        {details ? (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200">
              View details
            </summary>
            <pre className="mt-2 max-h-52 overflow-auto rounded-md bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
              {JSON.stringify(details, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {checkedAt
            ? `Checked ${new Date(checkedAt).toLocaleTimeString()}${
                typeof durationMs === "number" ? ` - ${durationMs}ms` : ""
              }`
            : "Not checked"}
        </span>
        <ConnectionTestButton
          onClick={onTest}
          loading={loading}
          label={testLabel}
        />
      </div>
    </div>
  );
}
