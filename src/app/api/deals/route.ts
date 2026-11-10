import { connection, NextResponse } from "next/server";
import { apiError, handleApiError, readJsonBody } from "@/lib/api";
import { createDealSchema, zodIssues } from "@/lib/validation";
import { createDeal, listDeals } from "@/services/deal.service";

export async function GET() {
  await connection();
  try {
    const deals = await listDeals();
    return NextResponse.json({ deals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  await connection();
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = createDealSchema.safeParse(body.data);
  if (!parsed.success) {
    return apiError(
      400,
      "VALIDATION_ERROR",
      "Invalid deal input",
      zodIssues(parsed.error),
    );
  }

  try {
    const deal = await createDeal(parsed.data);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
