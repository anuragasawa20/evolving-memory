export interface IntegrationLogEvent {
  service: string;
  operation: string;
  ok: boolean;
  message: string;
  durationMs?: number;
  code?: string;
  meta?: Record<string, unknown>;
}

/**
 * Structured integration logger.
 *
 * Callers must only pass non-sensitive metadata. Never pass API keys, private
 * keys, full model prompts, or customer transcripts in `meta`.
 */
export function logIntegration(event: IntegrationLogEvent): void {
  const payload = {
    ts: new Date().toISOString(),
    scope: "integration",
    ...event,
  };
  const line = JSON.stringify(payload);
  if (event.ok) {
    console.info(line);
  } else {
    console.error(line);
  }
}
