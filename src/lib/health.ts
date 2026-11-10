import type {
  HealthError,
  ServiceHealth,
  ServiceName,
  ServiceStatus,
} from "@/types/infrastructure";

export function buildHealth<TDetails>(params: {
  service: ServiceName;
  status: ServiceStatus;
  message: string;
  startedAt: number;
  details?: TDetails;
  error?: HealthError;
}): ServiceHealth<TDetails> {
  const health: ServiceHealth<TDetails> = {
    service: params.service,
    status: params.status,
    ok: params.status === "connected",
    message: params.message,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - params.startedAt,
  };
  if (params.details !== undefined) {
    health.details = params.details;
  }
  if (params.error !== undefined) {
    health.error = params.error;
  }
  return health;
}
