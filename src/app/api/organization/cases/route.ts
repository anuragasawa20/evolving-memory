import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { getStrategyExplorer } from "@/services/organizational-intelligence.service";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const categoryCode = url.searchParams.get("categoryCode");
  const subtype = url.searchParams.get("subtype");
  if (!categoryCode) {
    return apiError(400, "VALIDATION_ERROR", "categoryCode is required");
  }

  try {
    const organization = await getDefaultOrganizationContext();
    const result = await getStrategyExplorer(
      organization.organizationId,
      categoryCode,
      subtype,
    );
    if (!result) {
      return apiError(404, "CASE_CATEGORY_NOT_FOUND", "Case category not found");
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
