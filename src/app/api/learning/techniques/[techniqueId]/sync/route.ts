import { connection, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { retryPersonalTechniqueSync } from "@/services/technique.service";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ techniqueId: string }> },
) {
  await connection();
  try {
    const { techniqueId } = await params;
    const result = await retryPersonalTechniqueSync(techniqueId);
    return NextResponse.json({ sync: result });
  } catch (error) {
    return handleApiError(error);
  }
}
