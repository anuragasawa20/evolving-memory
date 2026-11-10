import { connection, NextResponse } from "next/server";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { createTechniqueSchema, zodIssues } from "@/lib/validation";
import { createTechnique, listTechniques } from "@/services/technique.service";

interface RouteContext {
  params: Promise<{ dealId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { dealId } = await params;
    const techniques = await listTechniques(dealId);
    return NextResponse.json({ techniques });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
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
    const { dealId } = await params;
    const technique = await createTechnique(dealId, parsed.data);
    if (!technique) {
      return apiError(404, "DEAL_OR_MEMORY_NOT_FOUND", "Deal or memory not found");
    }
    return NextResponse.json({ technique }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
