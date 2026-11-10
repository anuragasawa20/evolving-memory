/**
 * Hit every infrastructure health endpoint on a running DealOS server and print
 * a summary table.
 *
 * Usage:
 *   node scripts/health-check.mjs [baseUrl]
 *   node scripts/health-check.mjs http://localhost:3000 --write
 *
 * `--write` adds the mutating database + Walrus write/recall tests.
 */
const args = process.argv.slice(2);
const baseUrl =
  args.find((arg) => arg.startsWith("http")) ?? "http://localhost:3000";
const write = args.includes("--write");

const checks = [
  { name: "database", path: "/api/health/database" + (write ? "?test=write" : "") },
  { name: "llm", path: "/api/health/llm" },
  { name: "walrus", path: "/api/health/walrus" + (write ? "?test=write" : "") },
  { name: "tatum", path: "/api/health/tatum" },
];

async function main() {
  const results = [];

  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(120_000),
      });
      const body = await response.json();
      results.push({
        service: check.name,
        http: response.status,
        status: body.status ?? "unknown",
        ok: body.ok === true,
        message: body.message ?? "",
      });
    } catch (error) {
      results.push({
        service: check.name,
        http: 0,
        status: "unreachable",
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const result of results) {
    const mark = result.ok ? "PASS" : "FAIL";
    console.log(
      `[${mark}] ${result.service.padEnd(9)} http=${result.http} status=${result.status} :: ${result.message}`,
    );
  }

  const databaseOk = results.find((r) => r.service === "database")?.ok === true;
  if (!databaseOk) {
    console.error("\nDatabase check failed. Is `docker compose up -d` running?");
    process.exitCode = 1;
  }

  const missingConfig = results.filter(
    (r) => r.status === "configuration_missing",
  );
  if (missingConfig.length > 0) {
    console.log(
      `\nNote: ${missingConfig
        .map((r) => r.service)
        .join(", ")} not configured yet (add keys to .env to test).`,
    );
  }
}

await main();
