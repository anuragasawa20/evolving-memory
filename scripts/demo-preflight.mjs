#!/usr/bin/env node
/**
 * Hackathon demo pre-flight. Read-only except for a Walrus relayer health ping.
 *
 * Checks Node version, env presence (never prints secrets), PostgreSQL state,
 * demo deal readiness, organizational dataset readiness, and Walrus relayer
 * connectivity. Exits non-zero only when the demo cannot run.
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
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env is optional; ambient env wins.
  }
}

const problems = [];
const warnings = [];
const ok = (label, detail = "") =>
  console.log(`  \u2713 ${label}${detail ? ` — ${detail}` : ""}`);
const warn = (label, detail = "") => {
  warnings.push(label);
  console.log(`  ! ${label}${detail ? ` — ${detail}` : ""}`);
};
const fail = (label, detail = "") => {
  problems.push(label);
  console.log(`  \u2717 ${label}${detail ? ` — ${detail}` : ""}`);
};

console.log("\nDealOS demo pre-flight\n");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 22) {
  ok("Node", process.versions.node);
} else {
  fail("Node 22+ required", process.versions.node);
}

const requiredEnv = [
  "DATABASE_URL",
  "OPENROUTER_API_KEY",
  "MEMWAL_PRIVATE_KEY",
  "MEMWAL_ACCOUNT_ID",
];
for (const key of requiredEnv) {
  if (process.env[key]?.trim()) ok(`env ${key}`);
  else fail(`env ${key} is missing`);
}
for (const key of ["TATUM_API_KEY"]) {
  if (process.env[key]?.trim()) ok(`env ${key}`);
  else warn(`env ${key} is empty`, "Tatum panel will show configuration missing");
}

console.log("\nPostgreSQL");
let prisma;
try {
  const { PrismaClient } = await import("@prisma/client");
  prisma = new PrismaClient();
  await prisma.$queryRaw`SELECT 1`;
  ok("connection");

  const [deals, calls, facts, syncs, orgs, cases, techniques, playbooks] =
    await Promise.all([
      prisma.deal.count(),
      prisma.call.count(),
      prisma.extractedFact.count(),
      prisma.memorySync.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.organization.count(),
      prisma.caseInstance.count(),
      prisma.personalTechnique.count(),
      prisma.organizationalPlaybook.count(),
    ]);

  console.log(
    `  deals=${deals} calls=${calls} facts=${facts} orgs=${orgs} cases=${cases} techniques=${techniques} playbooks=${playbooks}`,
  );
  console.log(
    `  memorySync=${syncs.map((s) => `${s.status}:${s._count._all}`).join(", ") || "none"}`,
  );

  const demoDeals = await prisma.deal.findMany({
    where: { customerName: { contains: "ABC Fitness" } },
    orderBy: { updatedAt: "desc" },
    take: 1,
    include: {
      calls: {
        orderBy: { callNumber: "asc" },
        include: { memorySync: true, _count: { select: { facts: true } } },
      },
    },
  });

  if (demoDeals.length === 0) {
    warn(
      "No ABC Fitness demo deal",
      "create one or update docs/VIDEO_SCRIPT.md with your demo deal ID",
    );
  } else {
    const deal = demoDeals[0];
    const completed = deal.calls.filter(
      (call) =>
        call.analysisStatus === "COMPLETED" &&
        call.memorySync?.status === "COMPLETED",
    ).length;
    console.log(`  demo deal: ${deal.id} (${deal.calls.length} calls)`);
    for (const call of deal.calls) {
      console.log(
        `    call ${call.callNumber}: analysis=${call.analysisStatus} facts=${call._count.facts} walrus=${call.memorySync?.status ?? "none"}`,
      );
    }
    if (completed >= 1) ok("demo deal has a completed Walrus call");
    else warn("demo deal has no completed Walrus call");
    if (deal.calls.length >= 2) ok("two calls preserved");
    else warn("demo deal has fewer than two calls");
    console.log(`  recall: npm run memory:inspect -- ${deal.id} "What objections were raised?"`);
  }

  if (cases === 0 || playbooks === 0) {
    warn(
      "Organizational demo is not seeded",
      "open /intelligence and click Load synthetic demo",
    );
  } else {
    ok("organizational dataset seeded");
  }
} catch (error) {
  fail("PostgreSQL check failed", error.message);
} finally {
  await prisma?.$disconnect();
}

console.log("\nWalrus Memory Mainnet");
try {
  const { MemWal } = await import("@mysten-incubation/memwal");
  const client = MemWal.create({
    key: process.env.MEMWAL_PRIVATE_KEY,
    accountId: process.env.MEMWAL_ACCOUNT_ID,
    serverUrl:
      process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz",
    namespace: process.env.MEMWAL_NAMESPACE || "dealos_demo_deals",
    requestTimeoutMs: 20_000,
    preflightTimeoutMs: 20_000,
  });
  try {
    let health;
    try {
      health = await client.health();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      health = await client.health();
    }
    ok(
      "relayer health",
      `${health.status}${health.write_ready === false ? " (writes not ready)" : ""}`,
    );
    if (health.write_ready === false) {
      warn("relayer reports writes are not ready");
    }
  } finally {
    client.destroy();
  }
} catch (error) {
  warn(
    "Walrus relayer health check failed",
    `${error.message} — existing demo data may still work, but new writes may fail`,
  );
}

console.log("\nNext");
console.log("  1. npm run dev");
console.log("  2. Open http://localhost:3000/deals");
console.log("  3. Keep docs/VIDEO_SCRIPT.md open while recording");
console.log("  4. Never show .env, API keys, or private keys on camera\n");

if (warnings.length > 0) {
  console.log(`Warnings: ${warnings.length}`);
}
if (problems.length > 0) {
  console.log(`Blocking problems: ${problems.length}`);
  process.exitCode = 1;
} else {
  console.log("Demo pre-flight passed.\n");
}
