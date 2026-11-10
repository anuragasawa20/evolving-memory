export type ServiceStatus =
  | "connected"
  | "disconnected"
  | "configuration_missing"
  | "test_failed";

export type ServiceName = "database" | "llm" | "walrus" | "tatum";

export interface HealthError {
  code: string;
  message: string;
}

export interface ServiceHealth<TDetails = Record<string, unknown>> {
  service: ServiceName;
  status: ServiceStatus;
  ok: boolean;
  message: string;
  checkedAt: string;
  durationMs: number;
  details?: TDetails;
  error?: HealthError;
}

export interface DatabaseTestDetails {
  latencyMs: number;
  totalRows?: number;
  roundTripId?: string;
}

export interface LlmTestDetails {
  requestedModel: string;
  responseModel?: string;
  response?: {
    status: string;
    message: string;
  };
}

export interface MemoryTestDetails {
  namespace: string;
  serverUrl: string;
  relayerStatus?: string;
  write?: {
    blobId?: string;
    jobId?: string;
    owner?: string;
  };
  recall?: {
    matched: number;
    relevant: boolean;
    topDistance?: number;
    topText?: string;
  };
}

export interface WalrusAccountObjectSummary {
  objectId: string;
  found: boolean;
  type?: string;
  owner?: string;
}

export interface TatumTestDetails {
  rpcUrl: string;
  chainIdentifier?: string;
  latestCheckpoint?: string;
  accountObject?: WalrusAccountObjectSummary | null;
}
