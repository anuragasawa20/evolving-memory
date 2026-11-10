#!/usr/bin/env node
/**
 * Inspect Walrus Memory Mainnet directly through the MemWal relayer.
 *
 * Usage:
 *   node scripts/memory-inspect.mjs
 *   node scripts/memory-inspect.mjs <dealId> "recall query"
 *
 * This lists the configured namespace and paginates the account's memories.
 * When a deal ID is supplied it also performs the same deal-scoped recall the
 * application uses. Private keys are never printed.
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
    // .env is optional.
  }
}

const namespace = process.env.MEMWAL_NAMESPACE || "dealos_demo_deals";
const dealId = process.argv[2];
const query = process.argv[3] || "customer pain points and objections";

const { MemWal } = await import("@mysten-incubation/memwal");

const client = MemWal.create({
  key: process.env.MEMWAL_PRIVATE_KEY,
  accountId: process.env.MEMWAL_ACCOUNT_ID,
  serverUrl:
    process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz",
  namespace,
  requestTimeoutMs: 30_000,
});

try {
  const health = await client.health();
  console.log(
    JSON.stringify(
      {
        mainnetRelayer: process.env.MEMWAL_SERVER_URL,
        namespace,
        relayerStatus: health.status,
        relayerVersion: health.relayerVersion ?? health.version,
        writeReady: health.write_ready,
      },
      null,
      2,
    ),
  );

  const namespaces = await client.listNamespaces({ limit: 100 });
  console.log("\nNamespaces:");
  for (const item of namespaces.namespaces) {
    console.log(
      `- ${item.name}: ${item.memory_count} memories, updated ${item.updated_at}`,
    );
  }

  const memories = [];
  let cursor;
  let more = true;
  while (more) {
    const page = await client.listMemories({
      cursor,
      limit: 500,
      namespace,
    });
    memories.push(...page.memories);
    cursor = page.next_cursor ?? undefined;
    more = page.has_more;
  }

  console.log(`\nNamespace "${namespace}": ${memories.length} indexed memories`);
  for (const memory of memories.slice(0, 15)) {
    console.log(
      `- ${memory.created_at} blob=${memory.blob_id} id=${memory.memory_id}`,
    );
  }

  if (dealId) {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    let dealBlobIds = new Set();
    try {
      const syncs = await prisma.memorySync.findMany({
        where: { dealId },
        select: { jobReferences: true },
      });
      for (const sync of syncs) {
        const results = sync.jobReferences?.results;
        if (!Array.isArray(results)) continue;
        for (const item of results) {
          if (item && typeof item === "object" && item.blob_id) {
            dealBlobIds.add(item.blob_id);
          }
        }
      }
    } finally {
      await prisma.$disconnect();
    }

    const scopedQuery = `Deal ID: ${dealId}. ${query}`;
    const recall = await client.recall({
      query: scopedQuery,
      limit: 100,
      namespace,
    });
    const results = recall.results
      .filter(
        (memory) =>
          dealBlobIds.has(memory.blob_id) || memory.text.includes(dealId),
      )
      .slice(0, 20);
    console.log(
      `\nDeal-scoped recall for ${dealId}: ${results.length} result(s) (${dealBlobIds.size} known blobs)`,
    );
    for (const memory of results) {
      console.log(
        `- distance=${memory.distance.toFixed(3)} blob=${memory.blob_id}`,
      );
      console.log(`  ${memory.text.replace(/\n/g, "\n  ")}`);
    }
  }
} finally {
  client.destroy();
}
