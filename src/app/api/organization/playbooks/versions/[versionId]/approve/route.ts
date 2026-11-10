import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { approvePlaybookVersion } from "@/services/organizational-intelligence.service";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  await connection();
  try {
    const organization = await getDefaultOrganizationContext();
    const { versionId } = await params;
    const result = await approvePlaybookVersion({
      organizationId: organization.organizationId,
      versionId,
      approverId: organization.salespersonId,
    });
    if (!result) {
      return apiError(404, "PLAYBOOK_VERSION_NOT_FOUND", "Playbook version not found");
    }
    return NextResponse.json({
      version: result.version,
      walrus: result.walrus,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
