import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getOrganizationIntelligence } from "@/services/organizational-intelligence.service";
import { getDefaultOrganizationContext } from "@/services/organization.service";

export async function GET() {
  await connection();
  try {
    const organization = await getDefaultOrganizationContext();
    const intelligence = await getOrganizationIntelligence(
      organization.organizationId,
    );
    if (!intelligence) {
      return apiError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
    }
    return NextResponse.json(intelligence);
  } catch (error) {
    return handleApiError(error);
  }
}
