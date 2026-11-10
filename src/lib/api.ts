import { NextResponse } from "next/server";
import { IntegrationError, toSafeError } from "@/lib/errors";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiErrorBody = { error: { code, message } };
  if (details !== undefined) {
    body.error.details = details;
  }
  return NextResponse.json(body, { status });
}

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: apiError(400, "INVALID_JSON", "Request body must be valid JSON"),
    };
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  CONFIG_MISSING: 500,
  UNAUTHORIZED: 502,
  INSUFFICIENT_CREDITS: 502,
  RATE_LIMITED: 429,
  TIMEOUT: 504,
  PROVIDER_ERROR: 502,
  INVALID_RESPONSE: 502,
  DB_UNAVAILABLE: 503,
  DB_AUTH_FAILED: 503,
  NETWORK_ERROR: 502,
  UNKNOWN: 500,
};

export function handleApiError(error: unknown) {
  const safe = toSafeError(error);
  const status = error instanceof IntegrationError
    ? STATUS_BY_CODE[safe.code] ?? 500
    : STATUS_BY_CODE[safe.code] ?? 500;
  return apiError(status, safe.code, safe.message);
}
