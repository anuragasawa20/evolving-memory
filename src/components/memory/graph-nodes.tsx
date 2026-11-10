"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  BookOpen,
  Brain,
  BriefcaseBusiness,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { FactCategory } from "@/types/deal";
import type { GraphNodeType } from "@/types/memory";

export interface ExplorerNodeData {
  label: string;
  subtitle?: string;
  nodeType: GraphNodeType;
  category?: FactCategory;
  isInferred?: boolean;
  versionCount?: number;
  status?: string;
  highlighted?: boolean;
  dimmed?: boolean;
  [key: string]: unknown;
}

const CATEGORY_ACCENT: Record<
  string,
  { border: string; icon: string; label: string }
> = {
  PAIN_POINT: {
    border: "border-red-500/40",
    icon: "bg-red-500/10 text-red-600 dark:text-red-400",
    label: "text-red-600 dark:text-red-400",
  },
  OBJECTION: {
    border: "border-orange-500/40",
    icon: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    label: "text-orange-600 dark:text-orange-400",
  },
  BUYING_SIGNAL: {
    border: "border-emerald-500/40",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "text-emerald-600 dark:text-emerald-400",
  },
  REQUIREMENT: {
    border: "border-blue-500/40",
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "text-blue-600 dark:text-blue-400",
  },
  COMMITMENT: {
    border: "border-violet-500/40",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    label: "text-violet-600 dark:text-violet-400",
  },
  STAKEHOLDER: {
    border: "border-neutral-400/50",
    icon: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-300",
    label: "text-neutral-600 dark:text-neutral-300",
  },
  BUDGET: {
    border: "border-amber-500/40",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "text-amber-600 dark:text-amber-400",
  },
  TIMELINE: {
    border: "border-amber-500/40",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "text-amber-600 dark:text-amber-400",
  },
  DECISION_CRITERIA: {
    border: "border-violet-500/40",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    label: "text-violet-600 dark:text-violet-400",
  },
  OTHER: {
    border: "border-neutral-400/50",
    icon: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-300",
    label: "text-neutral-600 dark:text-neutral-300",
  },
};

function NodeFrame({
  data,
  icon,
  iconClassName,
  borderClassName,
  labelClassName,
}: {
  data: ExplorerNodeData;
  icon: ReactNode;
  iconClassName: string;
  borderClassName: string;
  labelClassName: string;
}) {
  return (
    <div
      className={cn(
        "w-[230px] rounded-xl border bg-white p-3 text-left shadow-sm transition dark:bg-neutral-900",
        borderClassName,
        data.dimmed ? "opacity-25" : "opacity-100",
        data.highlighted
          ? "ring-2 ring-neutral-500/70 ring-offset-2 ring-offset-white dark:ring-offset-neutral-950"
          : "",
      )}
      title={data.subtitle}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-neutral-400"
      />
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            iconClassName,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-[9px] font-semibold uppercase tracking-wider",
              labelClassName,
            )}
          >
            {data.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
            {data.subtitle || data.label}
          </p>
        </div>
      </div>
      {data.nodeType === "memory" ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] text-neutral-500 dark:text-neutral-400">
          <span>{data.isInferred ? "Inferred" : "Explicit"}</span>
          <span aria-hidden>·</span>
          <span>
            {data.versionCount ?? 1} version
            {(data.versionCount ?? 1) === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}
      {data.nodeType === "call" ? (
        <p className="mt-2 text-[9px] text-neutral-500 dark:text-neutral-400">
          {data.status ?? "Analysis"}
        </p>
      ) : null}
      {data.nodeType === "recommendation" ? (
        <p className="mt-2 text-[9px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          {String(data.status ?? "SUGGESTED")}
        </p>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-neutral-400"
      />
    </div>
  );
}

export function DealNode({ data }: NodeProps) {
  const nodeData = data as ExplorerNodeData;
  return (
    <NodeFrame
      data={nodeData}
      icon={<BriefcaseBusiness className="h-4 w-4" />}
      iconClassName="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
      borderClassName="border-neutral-900/60 dark:border-neutral-100/40"
      labelClassName="text-neutral-500 dark:text-neutral-400"
    />
  );
}

export function CallNode({ data }: NodeProps) {
  const nodeData = data as ExplorerNodeData;
  return (
    <NodeFrame
      data={nodeData}
      icon={<PhoneCall className="h-4 w-4" />}
      iconClassName="bg-slate-500/10 text-slate-600 dark:text-slate-300"
      borderClassName="border-slate-400/50"
      labelClassName="text-slate-600 dark:text-slate-300"
    />
  );
}

export function MemoryNode({ data }: NodeProps) {
  const nodeData = data as ExplorerNodeData;
  const accent =
    CATEGORY_ACCENT[nodeData.category ?? "OTHER"] ?? CATEGORY_ACCENT.OTHER;
  return (
    <NodeFrame
      data={nodeData}
      icon={<Brain className="h-4 w-4" />}
      iconClassName={accent.icon}
      borderClassName={accent.border}
      labelClassName={accent.label}
    />
  );
}

export function TechniqueNode({ data }: NodeProps) {
  const nodeData = data as ExplorerNodeData;
  return (
    <NodeFrame
      data={nodeData}
      icon={<BookOpen className="h-4 w-4" />}
      iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
      borderClassName="border-violet-400/50"
      labelClassName="text-violet-600 dark:text-violet-400"
    />
  );
}

export function RecommendationNode({ data }: NodeProps) {
  const nodeData = data as ExplorerNodeData;
  return (
    <NodeFrame
      data={nodeData}
      icon={<Sparkles className="h-4 w-4" />}
      iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      borderClassName="border-emerald-500/50"
      labelClassName="text-emerald-600 dark:text-emerald-400"
    />
  );
}

export const nodeTypes = {
  deal: DealNode,
  call: CallNode,
  memory: MemoryNode,
  technique: TechniqueNode,
  recommendation: RecommendationNode,
};
