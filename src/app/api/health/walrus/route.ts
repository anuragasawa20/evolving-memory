import { connection, NextResponse } from "next/server";
import {
  testMemoryConnection,
  testMemoryReadWrite,
} from "@/services/memory.service";
import { buildHealth } from "@/lib/health";
import { toSafeError } from "@/lib/errors";

export const maxDuration = 60;

export async function GET(request: Request) {
  await connection();
  const startedAt = Date.now();
  try {
    const url = new URL(request.url);
    const runWrite = url.searchParams.get("test") === "write";

    // A write/recall test is only run when explicitly requested. A plain GET
    // performs a cheap configuration + relayer connectivity check and never
    // persists a new memory.
    const result = runWrite
      ? await testMemoryReadWrite()
      : await testMemoryConnection();

    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json(
      buildHealth({
        service: "walrus",
        status: "test_failed",
        message: safe.message,
        startedAt,
        error: safe,
      }),
      { status: 500 },
    );
  }
}
