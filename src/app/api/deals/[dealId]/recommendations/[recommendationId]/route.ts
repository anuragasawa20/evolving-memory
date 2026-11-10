import { connection, NextResponse } from "next/server";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import {
  updateRecommendationSchema,
  zodIssues,
} from "@/lib/validation";
import {
  getRecommendationDetail,
  updateRecommendationStatus,
} from "@/services/memory-explorer.service";

interface RouteContext {
  params: Promise<{ dealId: string; recommendationId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { dealId, recommendationId } = await params;
    const recommendation = await getRecommendationDetail(
      dealId,
      recommendationId,
    );
    if (!recommendation) {
      return apiError(
        404,
        "RECOMMENDATION_NOT_FOUND",
        "Recommendation not found",
      );
    }
    return NextResponse.json({ recommendation });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = updateRecommendationSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid recommendation status",
      zodIssues(parsed.error),
    );
  }

  try {
    const { dealId, recommendationId } = await params;
    const recommendation = await updateRecommendationStatus(
      dealId,
      recommendationId,
      parsed.data.status,
    );
    if (!recommendation) {
      return apiError(
        404,
        "RECOMMENDATION_NOT_FOUND",
        "Recommendation not found",
      );
    }
    return NextResponse.json({ recommendation });
  } catch (error) {
    return handleApiError(error);
  }
}
