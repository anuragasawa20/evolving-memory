import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { retryMemorySync } from "@/services/memory.service";

export const maxDuration = 900;

interface RouteContext {
  params: Promise<{ callId: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { callId } = await params;
    const result = await retryMemorySync(callId);
    if (!result) {
      return apiError(
        404,
        "MEMORY_SYNC_NOT_FOUND",
        "No memory sync record exists for this call",
      );
    }
    return NextResponse.json({ memorySync: result });
  } catch (error) {
    return handleApiError(error);
  }
}
