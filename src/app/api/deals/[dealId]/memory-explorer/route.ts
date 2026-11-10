import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getMemoryExplorer } from "@/services/memory-explorer.service";

interface RouteContext {
  params: Promise<{ dealId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { dealId } = await params;
    const explorer = await getMemoryExplorer(dealId);
    if (!explorer) {
      return apiError(404, "DEAL_NOT_FOUND", "Deal not found");
    }
    return NextResponse.json(explorer);
  } catch (error) {
    return handleApiError(error);
  }
}
