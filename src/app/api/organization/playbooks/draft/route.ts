import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import {
  caseCategoryCodeSchema,
  caseSubtypeCodeSchema,
  isValidCaseClassification,
} from "@/lib/case-taxonomy";
import { zodIssues } from "@/lib/validation";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { createPlaybookDraft } from "@/services/organizational-intelligence.service";

export const maxDuration = 300;

const bodySchema = z.object({
  categoryCode: caseCategoryCodeSchema,
  subtype: caseSubtypeCodeSchema,
});

export async function POST(request: Request) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid playbook draft request",
      zodIssues(parsed.error),
    );
  }
  if (
    !isValidCaseClassification(
      parsed.data.categoryCode,
      parsed.data.subtype,
    )
  ) {
    return apiError(
      400,
      "INVALID_CASE_CLASSIFICATION",
      "Subtype does not belong to the selected category",
    );
  }

  try {
    const organization = await getDefaultOrganizationContext();
    const draft = await createPlaybookDraft({
      organizationId: organization.organizationId,
      organizationName: organization.organizationName,
      categoryCode: parsed.data.categoryCode,
      subtype: parsed.data.subtype,
    });
    if (!draft) {
      return apiError(
        409,
        "INSUFFICIENT_EVIDENCE",
        "No comparable case evidence is available for this subtype",
      );
    }
    return NextResponse.json({ playbook: draft }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
