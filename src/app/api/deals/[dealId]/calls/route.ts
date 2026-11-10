import { after, connection, NextResponse } from "next/server";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { createCallSchema, zodIssues } from "@/lib/validation";
import {
  createCall,
  listDealCalls,
  processCallAnalysis,
} from "@/services/call.service";

export const maxDuration = 900;

interface RouteContext {
  params: Promise<{ dealId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { dealId } = await params;
    const calls = await listDealCalls(dealId);
    if (!calls) {
      return apiError(404, "DEAL_NOT_FOUND", "Deal not found");
    }
    return NextResponse.json({ calls });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = createCallSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid transcript input",
      zodIssues(parsed.error),
    );
  }

  try {
    const { dealId } = await params;
    const call = await createCall(dealId, parsed.data);
    if (!call) {
      return apiError(404, "DEAL_NOT_FOUND", "Deal not found");
    }

    try {
      after(() => processCallAnalysis(call.id));
    } catch {
      // Fall back to fire-and-forget if the runtime has no request scope.
      void processCallAnalysis(call.id);
    }

    return NextResponse.json({ call }, { status: 202 });
  } catch (error) {
    return handleApiError(error);
  }
}
