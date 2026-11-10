import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getMemoryDetail } from "@/services/memory-explorer.service";

interface RouteContext {
  params: Promise<{ dealId: string; memoryId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { dealId, memoryId } = await params;
    const memory = await getMemoryDetail(dealId, memoryId);
    if (!memory) {
      return apiError(404, "MEMORY_NOT_FOUND", "Memory not found");
    }
    return NextResponse.json({ memory });
  } catch (error) {
    return handleApiError(error);
  }
}
