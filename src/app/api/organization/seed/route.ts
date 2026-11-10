import { connection, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { seedOrganizationDemo } from "@/services/organization-seed.service";

export const maxDuration = 300;

export async function POST() {
  await connection();
  try {
    const result = await seedOrganizationDemo();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
