import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { rejectPlaybookVersion } from "@/services/organizational-intelligence.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  await connection();
  try {
    const organization = await getDefaultOrganizationContext();
    const { versionId } = await params;
    const version = await rejectPlaybookVersion({
      organizationId: organization.organizationId,
      versionId,
    });
    if (!version) {
      return apiError(404, "PLAYBOOK_VERSION_NOT_FOUND", "Playbook version not found");
    }
    return NextResponse.json({ version });
  } catch (error) {
    return handleApiError(error);
  }
}
