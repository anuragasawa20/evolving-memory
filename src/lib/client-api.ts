import type { ApiErrorBody } from "@/lib/api";

export async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body?.error?.message) {
      const details = body.error.details;
      if (Array.isArray(details) && details.length > 0) {
        const first = details[0] as { message?: string; path?: string };
        if (first?.message) {
          return `${body.error.message}: ${first.message}`;
        }
      }
      return body.error.message;
    }
  } catch {
    // Fall through.
  }
  return `Request failed with status ${response.status}`;
}
