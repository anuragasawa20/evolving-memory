"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  CircleAlert,
  GitCompareArrows,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TimelineEventType, TimelineEventView } from "@/types/memory";

type TimelineGroup = "calls" | "memories" | "techniques" | "recommendations" | "sync";

const GROUP_BY_EVENT: Record<TimelineEventType, TimelineGroup> = {
  CALL_ANALYZED: "calls",
  MEMORY_CREATED: "memories",
  MEMORY_CONFIRMED: "memories",
  MEMORY_REFINED: "memories",
  MEMORY_CONTRADICTED: "memories",
  TECHNIQUE_ADDED: "techniques",
  RECOMMENDATION_GENERATED: "recommendations",
  MEMORY_SYNCED: "sync",
  MEMORY_SYNC_FAILED: "sync",
};

const GROUP_LABELS: Record<TimelineGroup, string> = {
  calls: "Calls",
  memories: "Memory changes",
  techniques: "Techniques",
  recommendations: "Recommendations",
  sync: "Walrus sync",
};

const EVENT_ICONS: Record<TimelineEventType, typeof Brain> = {
  CALL_ANALYZED: PhoneCall,
  MEMORY_CREATED: Brain,
  MEMORY_CONFIRMED: CheckCircle2,
  MEMORY_REFINED: RefreshCw,
  MEMORY_CONTRADICTED: GitCompareArrows,
  TECHNIQUE_ADDED: BookOpen,
  RECOMMENDATION_GENERATED: Sparkles,
  MEMORY_SYNCED: CheckCircle2,
  MEMORY_SYNC_FAILED: CircleAlert,
};

const EVENT_TONES: Record<TimelineEventType, string> = {
  CALL_ANALYZED: "text-slate-600 dark:text-slate-300",
  MEMORY_CREATED: "text-blue-600 dark:text-blue-400",
  MEMORY_CONFIRMED: "text-emerald-600 dark:text-emerald-400",
  MEMORY_REFINED: "text-amber-600 dark:text-amber-400",
  MEMORY_CONTRADICTED: "text-red-600 dark:text-red-400",
  TECHNIQUE_ADDED: "text-violet-600 dark:text-violet-400",
  RECOMMENDATION_GENERATED: "text-emerald-600 dark:text-emerald-400",
  MEMORY_SYNCED: "text-emerald-600 dark:text-emerald-400",
  MEMORY_SYNC_FAILED: "text-red-600 dark:text-red-400",
};

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function eventSummary(event: TimelineEventView): string | null {
  const metadata = event.metadata;
  if (!metadata) return null;

  if (
    event.eventType === "CALL_ANALYZED" &&
    typeof metadata.created === "number"
  ) {
    const parts = [
      `${metadata.created} new`,
      `${metadata.confirmed ?? 0} confirmed`,
      `${metadata.refined ?? 0} refined`,
      `${metadata.contradicted ?? 0} contradicted`,
    ];
    return parts.join(" · ");
  }

  if (typeof metadata.versionNumber === "number") {
    return `Version ${metadata.versionNumber}`;
  }

  if (typeof metadata.source === "string" && metadata.source) {
    return metadata.source;
  }

  return null;
}

export function MemoryTimeline({
  timeline,
  activeEventIds,
  onSelectEvent,
}: {
  timeline: TimelineEventView[];
  activeEventIds: Set<string>;
  onSelectEvent: (event: TimelineEventView) => void;
}) {
  const [groups, setGroups] = useState<Record<TimelineGroup, boolean>>({
    calls: true,
    memories: true,
    techniques: true,
    recommendations: true,
    sync: true,
  });
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const filtered = useMemo(
    () =>
      timeline.filter((event) => groups[GROUP_BY_EVENT[event.eventType]]),
    [timeline, groups],
  );

  const days = useMemo(() => {
    const grouped = new Map<string, TimelineEventView[]>();
    for (const event of filtered) {
      const key = event.createdAt.slice(0, 10);
      const list = grouped.get(key) ?? [];
      list.push(event);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries());
  }, [filtered]);

  useEffect(() => {
    if (activeEventIds.size === 0) return;
    for (const event of timeline) {
      if (!activeEventIds.has(event.id)) continue;
      const element = itemRefs.current.get(event.id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "nearest" });
        break;
      }
    }
  }, [activeEventIds, timeline]);

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Memory timeline</h2>
          <span className="text-[11px] text-neutral-400">
            {filtered.length} events
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(GROUP_LABELS) as TimelineGroup[]).map((group) => (
            <button
              key={group}
              type="button"
              onClick={() =>
                setGroups((current) => ({
                  ...current,
                  [group]: !current[group],
                }))
              }
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-medium transition",
                groups[group]
                  ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-400",
              )}
            >
              {GROUP_LABELS[group]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[280px] flex-1 overflow-y-auto px-4 py-3 lg:max-h-[calc(100vh-330px)]">
        {days.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            No timeline events match these filters.
          </p>
        ) : (
          <div className="space-y-5">
            {days.map(([day, events]) => (
              <section key={day}>
                <h3 className="sticky top-0 z-10 -mx-1 bg-white/95 px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 backdrop-blur dark:bg-neutral-900/95 dark:text-neutral-400">
                  {formatDay(events[0].createdAt)}
                </h3>
                <ol className="mt-1 space-y-1.5">
                  {events.map((event) => {
                    const Icon = EVENT_ICONS[event.eventType];
                    const active = activeEventIds.has(event.id);
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          ref={(element) => {
                            if (element) itemRefs.current.set(event.id, element);
                            else itemRefs.current.delete(event.id);
                          }}
                          onClick={() => onSelectEvent(event)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left transition",
                            active
                              ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-800/60"
                              : "border-transparent hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/40",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 dark:bg-neutral-800",
                                EVENT_TONES[event.eventType],
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                  {event.title}
                                </p>
                                <time className="shrink-0 text-[10px] text-neutral-400">
                                  {new Date(event.createdAt).toLocaleTimeString(
                                    "en-US",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      hour12: false,
                                      timeZone: "UTC",
                                    },
                                  )}
                                </time>
                              </div>
                              {event.description ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
                                  {event.description}
                                </p>
                              ) : null}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {event.sourceCall ? (
                                  <Badge tone="neutral">
                                    Call {event.sourceCall.callNumber}
                                  </Badge>
                                ) : null}
                                {event.eventType === "MEMORY_SYNCED" ? (
                                  <Badge tone="green">Walrus synced</Badge>
                                ) : null}
                                {event.eventType === "MEMORY_SYNC_FAILED" ? (
                                  <Badge tone="red">Walrus failed</Badge>
                                ) : null}
                                {eventSummary(event) ? (
                                  <span className="text-[10px] text-neutral-400">
                                    {eventSummary(event)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 px-4 py-2 text-[10px] text-neutral-400 dark:border-neutral-800">
        <span className="inline-flex items-center gap-1">
          <MessageSquareText className="h-3 w-3" />
          Events reflect recorded memory lifecycle changes, not row timestamps
          alone. Times are shown in UTC.
        </span>
      </div>
    </div>
  );
}
