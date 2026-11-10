import { connection, NextResponse } from "next/server";
import { testDatabaseConnection } from "@/services/database.service";
import { buildHealth } from "@/lib/health";
import { toSafeError } from "@/lib/errors";

export async function GET(request: Request) {
  await connection();
  const startedAt = Date.now();
  try {
    const url = new URL(request.url);
    const write = url.searchParams.get("test") === "write";
    const result = await testDatabaseConnection({ write });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json(
      buildHealth({
        service: "database",
        status: "test_failed",
        message: safe.message,
        startedAt,
        error: safe,
      }),
      { status: 500 },
    );
  }
}
