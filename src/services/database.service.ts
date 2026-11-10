import { prisma } from "@/lib/prisma";
import { loadEnv } from "@/lib/env";
import { toSafeError } from "@/lib/errors";
import { buildHealth } from "@/lib/health";
import { logIntegration } from "@/lib/logger";
import type { DatabaseTestDetails, ServiceHealth } from "@/types/infrastructure";

interface PrismaLikeError {
  code?: string;
}

function mapPrismaError(error: unknown) {
  const code = (error as PrismaLikeError | undefined)?.code;
  if (code === "P1001" || code === "P1002" || code === "P1017") {
    return {
      code: "DB_UNAVAILABLE" as const,
      message: "PostgreSQL is not reachable. Is `docker compose up -d` running?",
    };
  }
  if (code === "P1000") {
    return {
      code: "DB_AUTH_FAILED" as const,
      message: "PostgreSQL rejected the credentials in DATABASE_URL",
    };
  }
  return toSafeError(error);
}

export async function testDatabaseConnection(options?: {
  write?: boolean;
}): Promise<ServiceHealth<DatabaseTestDetails>> {
  const startedAt = Date.now();

  const env = loadEnv("database");
  if (!env.ok) {
    const message = `Missing configuration: ${env.missing.join(", ")}`;
    logIntegration({
      service: "database",
      operation: "test_connection",
      ok: false,
      message,
      code: "CONFIG_MISSING",
    });
    return buildHealth({
      service: "database",
      status: "configuration_missing",
      message,
      startedAt,
      error: { code: "CONFIG_MISSING", message },
    });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    const details: DatabaseTestDetails = {
      latencyMs: Date.now() - startedAt,
    };

    if (options?.write) {
      const created = await prisma.infrastructureTest.create({
        data: {
          label: `health-check-${Date.now()}`,
          payload: { source: "health-endpoint" },
        },
      });

      const readBack = await prisma.infrastructureTest.findUnique({
        where: { id: created.id },
      });

      if (!readBack) {
        throw new Error("Inserted row could not be read back");
      }

      await prisma.infrastructureTest.delete({ where: { id: created.id } });
      details.roundTripId = readBack.id;
    } else {
      details.totalRows = await prisma.infrastructureTest.count();
    }

    logIntegration({
      service: "database",
      operation: options?.write ? "read_write_test" : "test_connection",
      ok: true,
      message: "PostgreSQL reachable via Prisma",
      durationMs: Date.now() - startedAt,
    });

    return buildHealth({
      service: "database",
      status: "connected",
      message: options?.write
        ? "PostgreSQL read/write round-trip verified"
        : "PostgreSQL reachable via Prisma",
      startedAt,
      details,
    });
  } catch (error) {
    const safe = mapPrismaError(error);
    logIntegration({
      service: "database",
      operation: options?.write ? "read_write_test" : "test_connection",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
    });
    return buildHealth({
      service: "database",
      status: "disconnected",
      message: safe.message,
      startedAt,
      error: safe,
    });
  }
}
