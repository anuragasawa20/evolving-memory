import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { getPlaybookDetail } from "@/services/organizational-intelligence.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playbookId: string }> },
) {
  await connection();
  try {
    const organization = await getDefaultOrganizationContext();
    const { playbookId } = await params;
    const playbook = await getPlaybookDetail(
      organization.organizationId,
      playbookId,
    );
    if (!playbook) {
      return apiError(404, "PLAYBOOK_NOT_FOUND", "Playbook not found");
    }
    return NextResponse.json({ playbook });
  } catch (error) {
    return handleApiError(error);
  }
}
