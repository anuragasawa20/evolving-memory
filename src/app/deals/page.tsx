import { connection } from "next/server";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { CreateDealForm } from "@/components/deals/create-deal-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listDeals } from "@/services/deal.service";
import {
  STAGE_LABELS,
  STAGE_TONES,
  STATUS_TONES,
  formatDateTime,
} from "@/lib/display";

export const instant = false;

export default async function DealsPage() {
  await connection();
  const deals = await listDeals();

  const activeDeals = deals.filter((deal) => deal.status === "ACTIVE").length;
  const totalCalls = deals.reduce((sum, deal) => sum + deal.callCount, 0);

  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            Deal workspace
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Deals</h1>
          <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Capture every sales conversation. Nemotron extracts structured
            intelligence, PostgreSQL keeps the record, and Walrus Memory retains
            what the deal has taught you.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            label="Total deals"
            value={String(deals.length)}
          />
          <StatCard
            icon={<Sparkles className="h-4 w-4" />}
            label="Active"
            value={String(activeDeals)}
          />
          <StatCard
            icon={<MessageSquareText className="h-4 w-4" />}
            label="Calls analyzed"
            value={String(totalCalls)}
          />
        </div>

        <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                All deals
              </h2>
              <span className="text-xs text-neutral-400">
                {deals.length} {deals.length === 1 ? "deal" : "deals"}
              </span>
            </div>

            {deals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    <BriefcaseBusiness className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">No deals yet</p>
                  <p className="max-w-xs text-xs text-neutral-500 dark:text-neutral-400">
                    Create your first deal with the form to start a call
                    transcript workflow.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {deals.map((deal) => (
                  <Link
                    key={deal.id}
                    href={`/deals/${deal.id}`}
                    className="group block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                          {deal.customerName}
                        </h3>
                        <p className="mt-0.5 truncate text-sm text-neutral-500 dark:text-neutral-400">
                          {deal.productName}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STAGE_TONES[deal.stage]}>
                          {STAGE_LABELS[deal.stage]}
                        </Badge>
                        <Badge tone={STATUS_TONES[deal.status]}>
                          {deal.status}
                        </Badge>
                        {deal.isSynthetic ? (
                          <Badge tone="amber">Synthetic</Badge>
                        ) : null}
                      </div>
                    </div>

                    {deal.description ? (
                      <p className="mt-3 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {deal.description}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="inline-flex items-center gap-1.5">
                          <MessageSquareText className="h-3.5 w-3.5" />
                          {deal.callCount}{" "}
                          {deal.callCount === 1 ? "call" : "calls"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatDateTime(deal.lastActivityAt)}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 font-medium text-neutral-700 transition group-hover:gap-2 dark:text-neutral-300">
                        Open deal
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <CreateDealForm />
            <div className="rounded-xl border border-dashed border-neutral-300 p-4 text-xs leading-relaxed text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
              <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                Two persistence layers
              </p>
              <p className="mt-1">
                PostgreSQL stores the deal, calls and extracted facts. Walrus
                Memory separately persists durable sales experiences in the{" "}
                <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-800">
                  dealos_demo_deals
                </code>{" "}
                namespace. The UI reports both independently.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          {icon}
        </span>
        <div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {label}
          </p>
          <p className="text-xl font-semibold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
