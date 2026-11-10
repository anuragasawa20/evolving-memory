import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { zodIssues } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { generateRecommendationForCall } from "@/services/recommendation.service";

export const maxDuration = 300;

const bodySchema = z.object({ callId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> },
) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "A callId is required",
      zodIssues(parsed.error),
    );
  }

  try {
    const { dealId } = await params;
    const call = await prisma.call.findFirst({
      where: { id: parsed.data.callId, dealId },
      select: {
        id: true,
        callNumber: true,
        summary: true,
        analysisStatus: true,
      },
    });
    if (!call) {
      return apiError(404, "CALL_NOT_FOUND", "Call not found");
    }
    if (call.analysisStatus !== "COMPLETED") {
      return apiError(
        409,
        "CALL_NOT_ANALYZED",
        "The call must finish analysis before generating a recommendation",
      );
    }

    const recommendationId = await generateRecommendationForCall({
      dealId,
      callId: call.id,
      callNumber: call.callNumber,
      summary: call.summary ?? "No summary available.",
    });

    if (!recommendationId) {
      return apiError(
        502,
        "RECOMMENDATION_FAILED",
        "The model could not generate a valid recommendation. Try again.",
      );
    }

    return NextResponse.json({ recommendationId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
