import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { recallQuerySchema, zodIssues } from "@/lib/validation";
import { recallDealMemories } from "@/services/memory.service";

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ dealId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  await connection();
  const url = new URL(request.url);
  const parsed = recallQuerySchema.safeParse({
    query: url.searchParams.get("query") ?? "",
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid recall query",
      zodIssues(parsed.error),
    );
  }

  try {
    const { dealId } = await params;
    const result = await recallDealMemories(
      dealId,
      parsed.data.query,
      parsed.data.limit,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
