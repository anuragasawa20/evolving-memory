/**
 * PostgreSQL persistence probe.
 *
 * Usage:
 *   node scripts/db-persistence.mjs roundtrip   # insert, read back, delete
 *   node scripts/db-persistence.mjs insert      # insert a durable marker
 *   node scripts/db-persistence.mjs verify      # confirm marker survived restart
 *
 * For the persistence-across-restart check:
 *   node scripts/db-persistence.mjs insert
 *   docker restart dealos-postgres
 *   node scripts/db-persistence.mjs verify
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
loadDotEnv(join(here, "..", ".env"));

function loadDotEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, value] = match;
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env is optional; rely on the ambient environment.
  }
}

const phase = process.argv[2] ?? "roundtrip";
const markerLabel = "persistence-probe";

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  if (phase === "insert") {
    await prisma.infrastructureTest.deleteMany({ where: { label: markerLabel } });
    const created = await prisma.infrastructureTest.create({
      data: {
        label: markerLabel,
        payload: { note: "must survive restart", at: new Date().toISOString() },
      },
    });
    console.log(
      JSON.stringify({ phase, ok: true, id: created.id, at: created.createdAt }),
    );
  } else if (phase === "verify") {
    const row = await prisma.infrastructureTest.findFirst({
      where: { label: markerLabel },
    });
    if (!row) {
      console.error(
        JSON.stringify({ phase, ok: false, error: "marker row not found" }),
      );
      process.exitCode = 1;
    } else {
      console.log(
        JSON.stringify({ phase, ok: true, id: row.id, survived: true, payload: row.payload }),
      );
    }
  } else {
    const created = await prisma.infrastructureTest.create({
      data: { label: `roundtrip-${Date.now()}`, payload: { note: "roundtrip" } },
    });
    const readBack = await prisma.infrastructureTest.findUnique({
      where: { id: created.id },
    });
    await prisma.infrastructureTest.delete({ where: { id: created.id } });
    if (!readBack) {
      console.error(JSON.stringify({ phase, ok: false, error: "read-back failed" }));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ phase, ok: true, readBackId: readBack.id }));
    }
  }
} catch (error) {
  console.error(
    JSON.stringify({
      phase,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
