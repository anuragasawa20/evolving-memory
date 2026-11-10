export type IntegrationErrorCode =
  | "CONFIG_MISSING"
  | "UNAUTHORIZED"
  | "INSUFFICIENT_CREDITS"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE"
  | "DB_UNAVAILABLE"
  | "DB_AUTH_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class ConfigurationError extends Error {
  readonly code = "CONFIG_MISSING" as const;

  constructor(
    readonly group: string,
    readonly missing: string[],
  ) {
    super(`Missing configuration for ${group}: ${missing.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

export class IntegrationError extends Error {
  constructor(
    readonly code: IntegrationErrorCode,
    message: string,
    readonly service?: string,
    readonly statusHint?: number,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{8,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
  /suiprivkey1[0-9a-z]+/gi,
];

export function redact(input: string): string {
  return SECRET_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, "[REDACTED]"),
    input,
  );
}

export function toSafeError(error: unknown): {
  code: IntegrationErrorCode;
  message: string;
} {
  if (error instanceof ConfigurationError) {
    return { code: "CONFIG_MISSING", message: error.message };
  }
  if (error instanceof IntegrationError) {
    return { code: error.code, message: redact(error.message) };
  }
  if (error instanceof Error) {
    const message = redact(error.message || error.name);
    if (
      error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      /timed?\s?out/i.test(message)
    ) {
      return { code: "TIMEOUT", message: "Operation timed out" };
    }
    return { code: "UNKNOWN", message };
  }
  return { code: "UNKNOWN", message: "Unknown error" };
}
