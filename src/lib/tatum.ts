import { assertEnv } from "./env";
import { IntegrationError } from "./errors";

interface JsonRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export function getTatumEnv() {
  return assertEnv("tatum");
}

/**
 * Perform a Sui JSON-RPC call through the Tatum gateway.
 *
 * Tatum authenticates the request with the `x-api-key` header (recommended
 * method in the current Tatum docs). Requests are bounded by a 20s timeout.
 */
export async function suiRpc<T>(
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const env = getTatumEnv();

  let response: Response;
  try {
    response = await fetch(env.TATUM_SUI_RPC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.TATUM_API_KEY,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.name === "TimeoutError" ||
        /timed?\s?out/i.test(error.message))
    ) {
      throw new IntegrationError(
        "TIMEOUT",
        `Tatum RPC ${method} timed out`,
        "tatum",
      );
    }
    throw new IntegrationError(
      "NETWORK_ERROR",
      `Failed to reach Tatum RPC for ${method}`,
      "tatum",
    );
  }

  const raw = await response.text();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new IntegrationError(
        "UNAUTHORIZED",
        `Tatum rejected the API key (${response.status})`,
        "tatum",
        response.status,
      );
    }
    if (response.status === 429) {
      throw new IntegrationError(
        "RATE_LIMITED",
        "Tatum rate limit reached (429)",
        "tatum",
        response.status,
      );
    }
    if (response.status >= 500) {
      throw new IntegrationError(
        "PROVIDER_ERROR",
        `Tatum RPC upstream error (${response.status})`,
        "tatum",
        response.status,
      );
    }
    throw new IntegrationError(
      "PROVIDER_ERROR",
      `Tatum RPC request failed (${response.status})`,
      "tatum",
      response.status,
    );
  }

  let json: JsonRpcResponse<T>;
  try {
    json = JSON.parse(raw) as JsonRpcResponse<T>;
  } catch {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      "Tatum RPC returned a non-JSON response",
      "tatum",
    );
  }

  if (json.error) {
    throw new IntegrationError(
      "PROVIDER_ERROR",
      `Tatum RPC error ${json.error.code}: ${json.error.message}`,
      "tatum",
    );
  }

  if (json.result === undefined) {
    throw new IntegrationError(
      "INVALID_RESPONSE",
      "Tatum RPC response is missing a result field",
      "tatum",
    );
  }

  return json.result;
}
