import { Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  FACT_LABELS,
  FACT_SINGULAR,
  FACT_TONES,
  formatDate,
} from "@/lib/display";
import { FACT_CATEGORIES } from "@/lib/validation";
import type { FactCategory, FactView } from "@/types/deal";

export function FactList({
  facts,
  showSource = false,
}: {
  facts: FactView[];
  showSource?: boolean;
}) {
  if (facts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        No customer facts extracted yet.
      </p>
    );
  }

  const groups = FACT_CATEGORIES.map((category) => ({
    category,
    facts: facts.filter((fact) => fact.category === category),
  })).filter((group) => group.facts.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.category}>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={FACT_TONES[group.category]}>
              {FACT_LABELS[group.category]}
            </Badge>
            <span className="text-xs text-neutral-400">
              {group.facts.length}
            </span>
          </div>
          <ul className="space-y-2">
            {group.facts.map((fact) => (
              <FactRow
                key={fact.id}
                fact={fact}
                category={group.category}
                showSource={showSource}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FactRow({
  fact,
  category,
  showSource,
}: {
  fact: FactView;
  category: FactCategory;
  showSource: boolean;
}) {
  const severity =
    typeof fact.metadata?.severity === "string"
      ? fact.metadata.severity
      : null;

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {fact.content}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {severity ? (
            <Badge
              tone={
                severity === "HIGH"
                  ? "red"
                  : severity === "MEDIUM"
                    ? "amber"
                    : "neutral"
              }
            >
              {severity}
            </Badge>
          ) : null}
          {typeof fact.confidence === "number" ? (
            <span className="text-[11px] text-neutral-400">
              {Math.round(fact.confidence * 100)}%
            </span>
          ) : null}
        </div>
      </div>

      {fact.evidence ? (
        <blockquote className="mt-2 flex gap-2 rounded-md bg-neutral-50 px-3 py-2 text-xs italic leading-relaxed text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400">
          <Quote className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{fact.evidence}</span>
        </blockquote>
      ) : null}

      {showSource ? (
        <p className="mt-2 text-[11px] text-neutral-400">
          {FACT_SINGULAR[category]} from Call {fact.callNumber} ·{" "}
          {formatDate(fact.createdAt)}
        </p>
      ) : null}
    </li>
  );
}
