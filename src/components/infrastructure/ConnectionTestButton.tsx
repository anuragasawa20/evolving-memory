"use client";

import { Loader2, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectionTestButton({
  onClick,
  loading,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium transition",
        "hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800",
        loading && "cursor-not-allowed opacity-60",
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <PlugZap className="h-4 w-4" />
      )}
      {loading ? "Testing..." : label}
    </button>
  );
}
