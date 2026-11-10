import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type Tone =
  | "neutral"
  | "green"
  | "amber"
  | "red"
  | "blue"
  | "purple"
  | "orange";

const TONES: Record<Tone, string> = {
  neutral:
    "border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  green:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  red: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  purple:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  orange:
    "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn("h-1.5 w-1.5 rounded-full bg-current", className)} />;
}
