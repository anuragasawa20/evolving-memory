import { after, connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getCallById, processCallAnalysis } from "@/services/call.service";

export const maxDuration = 900;

interface RouteContext {
  params: Promise<{ callId: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { callId } = await params;
    const call = await getCallById(callId);
    if (!call) {
      return apiError(404, "CALL_NOT_FOUND", "Call not found");
    }
    if (call.analysisStatus === "COMPLETED") {
      return apiError(
        409,
        "ANALYSIS_ALREADY_COMPLETED",
        "This call has already been analyzed",
      );
    }

    try {
      after(() => processCallAnalysis(callId));
    } catch {
      void processCallAnalysis(callId);
    }

    return NextResponse.json(
      { callId, analysisStatus: "PENDING" },
      { status: 202 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
