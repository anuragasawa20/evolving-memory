import { connection, NextResponse } from "next/server";
import { testTatumConnection } from "@/services/tatum.service";
import { buildHealth } from "@/lib/health";
import { toSafeError } from "@/lib/errors";

export const maxDuration = 60;

export async function GET() {
  await connection();
  const startedAt = Date.now();
  try {
    const result = await testTatumConnection();
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json(
      buildHealth({
        service: "tatum",
        status: "test_failed",
        message: safe.message,
        startedAt,
        error: safe,
      }),
      { status: 500 },
    );
  }
}
