import { connection, NextResponse } from "next/server";
import { apiError, handleApiError } from "@/lib/api";
import { getCallById } from "@/services/call.service";

interface RouteContext {
  params: Promise<{ callId: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();
  try {
    const { callId } = await params;
    const call = await getCallById(callId);
    if (!call) {
      return apiError(404, "CALL_NOT_FOUND", "Call not found");
    }
    return NextResponse.json({ call });
  } catch (error) {
    return handleApiError(error);
  }
}
