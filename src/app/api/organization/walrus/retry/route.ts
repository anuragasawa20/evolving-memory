import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { zodIssues } from "@/lib/validation";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import { retryOrganizationMemorySync } from "@/services/organization-memory.service";

export const maxDuration = 300;

const bodySchema = z.object({ syncId: z.string().uuid() });

export async function POST(request: Request) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid retry request",
      zodIssues(parsed.error),
    );
  }

  try {
    const organization = await getDefaultOrganizationContext();
    const sync = await retryOrganizationMemorySync(parsed.data.syncId);
    if (!sync) {
      return apiError(404, "SYNC_NOT_FOUND", "Walrus sync record not found");
    }
    return NextResponse.json({ organizationId: organization.organizationId, sync });
  } catch (error) {
    return handleApiError(error);
  }
}
