"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  Database,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { ServiceStatusCard } from "@/components/infrastructure/ServiceStatusCard";
import type { CardStatus } from "@/components/infrastructure/ServiceStatusCard";
import type { ServiceHealth } from "@/types/infrastructure";

type ServiceKey = "database" | "llm" | "walrus" | "tatum";

interface CardState {
  status: CardStatus;
  message?: string;
  details?: unknown;
  error?: { code: string; message: string } | null;
  checkedAt?: string;
  durationMs?: number;
}

const ENDPOINTS: Record<ServiceKey, string> = {
  database: "/api/health/database",
  llm: "/api/health/llm",
  walrus: "/api/health/walrus",
  tatum: "/api/health/tatum",
};

const INITIAL_STATE: Record<ServiceKey, CardState> = {
  database: { status: "idle", message: "Not run yet." },
  llm: {
    status: "idle",
    message: "Not run yet. A real model call is only made when you test.",
  },
  walrus: { status: "idle", message: "Not run yet." },
  tatum: { status: "idle", message: "Not run yet." },
};

const INITIAL_LOADING: Record<ServiceKey, boolean> = {
  database: false,
  llm: false,
  walrus: false,
  tatum: false,
};

export default function InfrastructurePage() {
  const [states, setStates] =
    useState<Record<ServiceKey, CardState>>(INITIAL_STATE);
  const [loading, setLoading] =
    useState<Record<ServiceKey, boolean>>(INITIAL_LOADING);

  const run = useCallback(
    async (key: ServiceKey, options?: { write?: boolean }) => {
      setLoading((prev) => ({ ...prev, [key]: true }));
      try {
        let url = ENDPOINTS[key];
        if (options?.write) {
          url += "?test=write";
        }

        const response = await fetch(url, { cache: "no-store" });
        const body = (await response.json()) as ServiceHealth | null;

        if (body && typeof body === "object" && "service" in body) {
          setStates((prev) => ({
            ...prev,
            [key]: {
              status: body.status,
              message: body.message,
              details: body.details,
              error: body.error ?? null,
              checkedAt: body.checkedAt,
              durationMs: body.durationMs,
            },
          }));
        } else {
          setStates((prev) => ({
            ...prev,
            [key]: {
              status: "test_failed",
              message: "Health endpoint returned an unexpected response.",
            },
          }));
        }
      } catch (error) {
        setStates((prev) => ({
          ...prev,
          [key]: {
            status: "test_failed",
            message:
              error instanceof Error ? error.message : "Request failed.",
          },
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [],
  );

  const runSafeChecks = useCallback(() => {
    void run("database");
    void run("walrus");
    void run("tatum");
  }, [run]);

  useEffect(() => {
    // Cheap, read-only checks on load. The LLM test and the Walrus write/recall
    // test are intentionally NOT run automatically.
    runSafeChecks();
  }, [runSafeChecks]);

  const anyLoading =
    loading.database || loading.llm || loading.walrus || loading.tatum;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
            DealOS
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Infrastructure status
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Live checks for PostgreSQL, OpenRouter / NVIDIA Nemotron, Walrus
            Memory Mainnet, and Tatum Sui Mainnet RPC. Checks reflect real calls,
            not cached badges.
          </p>
        </div>
        <button
          type="button"
          onClick={runSafeChecks}
          disabled={anyLoading}
          className="inline-flex items-center gap-2 self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {anyLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh safe checks
        </button>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ServiceStatusCard
          title="PostgreSQL"
          description="Docker Postgres 17 + Prisma"
          icon={<Database className="h-5 w-5" />}
          status={states.database.status}
          message={states.database.message}
          details={states.database.details}
          error={states.database.error}
          checkedAt={states.database.checkedAt}
          durationMs={states.database.durationMs}
          loading={loading.database}
          onTest={() => run("database", { write: true })}
          testLabel="Test read/write"
          note="Read/write test inserts, reads back, then removes a temporary row."
        />

        <ServiceStatusCard
          title="OpenRouter / Nemotron"
          description="nvidia/nemotron-3-super (configurable)"
          icon={<Sparkles className="h-5 w-5" />}
          status={states.llm.status}
          message={states.llm.message}
          details={states.llm.details}
          error={states.llm.error}
          checkedAt={states.llm.checkedAt}
          durationMs={states.llm.durationMs}
          loading={loading.llm}
          onTest={() => run("llm")}
          testLabel="Test connection"
          note="This performs a real model call and validates the JSON response with Zod."
        />

        <ServiceStatusCard
          title="Walrus Memory Mainnet"
          description="dealos_demo_deals namespace"
          icon={<Brain className="h-5 w-5" />}
          status={states.walrus.status}
          message={states.walrus.message}
          details={states.walrus.details}
          error={states.walrus.error}
          checkedAt={states.walrus.checkedAt}
          durationMs={states.walrus.durationMs}
          loading={loading.walrus}
          onTest={() => run("walrus", { write: true })}
          testLabel="Test write & recall"
          note="The write/recall test persists one synthetic memory to Mainnet. Auto-checks only ping the relayer."
        />

        <ServiceStatusCard
          title="Tatum Sui Mainnet"
          description="sui-mainnet.gateway.tatum.io"
          icon={<Link2 className="h-5 w-5" />}
          status={states.tatum.status}
          message={states.tatum.message}
          details={states.tatum.details}
          error={states.tatum.error}
          checkedAt={states.tatum.checkedAt}
          durationMs={states.tatum.durationMs}
          loading={loading.tatum}
          onTest={() => run("tatum")}
          testLabel="Re-run chain check"
          note="Reads chain identifier, latest checkpoint, and the Walrus account object when configured."
        />
      </div>

      <p className="mt-8 text-xs text-neutral-500 dark:text-neutral-500">
        Health endpoints:{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
          /api/health/database
        </code>
        ,{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
          /api/health/llm
        </code>
        ,{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
          /api/health/walrus
        </code>
        ,{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
          /api/health/tatum
        </code>
        . Append{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
          ?test=write
        </code>{" "}
        to the database or Walrus endpoint for a mutating test.
      </p>
    </main>
  );
}
