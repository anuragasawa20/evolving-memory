import { connection, NextResponse } from "next/server";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { updateDealSchema, zodIssues } from "@/lib/validation";
import { getDealWorkspace, updateDeal } from "@/services/deal.service";

interface RouteContext {
  params: Promise<{ dealId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { dealId } = await params;
    const deal = await getDealWorkspace(dealId);
    if (!deal) {
      return apiError(404, "DEAL_NOT_FOUND", "Deal not found");
    }
    return NextResponse.json({ deal });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = updateDealSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid deal update",
      zodIssues(parsed.error),
    );
  }

  try {
    const { dealId } = await params;
    const deal = await updateDeal(dealId, parsed.data);
    if (!deal) {
      return apiError(404, "DEAL_NOT_FOUND", "Deal not found");
    }
    return NextResponse.json({ deal });
  } catch (error) {
    return handleApiError(error);
  }
}
