import { connection, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { syncPendingOrganizationMemories } from "@/services/organization-memory.service";

export const maxDuration = 300;

export async function POST() {
  await connection();
  try {
    const organization = await getDefaultOrganizationContext();
    const results = await syncPendingOrganizationMemories(
      organization.organizationId,
      10,
    );
    return NextResponse.json({ results });
  } catch (error) {
    return handleApiError(error);
  }
}
