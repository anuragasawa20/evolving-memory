import { connection, NextResponse } from "next/server";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { createTechniqueSchema, zodIssues } from "@/lib/validation";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import {
  createTechnique,
  listPersonalTechniques,
} from "@/services/technique.service";

export const maxDuration = 300;

export async function GET() {
  await connection();
  try {
    const organization = await getDefaultOrganizationContext();
    const techniques = await listPersonalTechniques(organization.organizationId);
    return NextResponse.json({ techniques });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = createTechniqueSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid technique",
      zodIssues(parsed.error),
    );
  }

  try {
    const organization = await getDefaultOrganizationContext();
    const technique = await createTechnique(null, parsed.data, {
      organizationId: organization.organizationId,
    });
    if (!technique) {
      return apiError(400, "TECHNIQUE_CREATE_FAILED", "Unable to create technique");
    }
    return NextResponse.json({ technique }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
