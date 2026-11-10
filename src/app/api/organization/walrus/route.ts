import { connection, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getDefaultOrganizationContext } from "@/services/organization.service";
import {
  getOrganizationMemoryStatus,
  recallCombinedOrganizationMemory,
} from "@/services/organization-memory.service";

export const maxDuration = 60;

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() ?? "";

  try {
    const organization = await getDefaultOrganizationContext();
    const status = await getOrganizationMemoryStatus(
      organization.organizationId,
    );
    const recall = query
      ? await recallCombinedOrganizationMemory(
          organization.organizationId,
          query,
          8,
        )
      : null;
    return NextResponse.json({ status, recall });
  } catch (error) {
    return handleApiError(error);
  }
}
