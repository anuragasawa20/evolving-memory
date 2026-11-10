import { getTatumEnv, suiRpc } from "@/lib/tatum";
import { toSafeError } from "@/lib/errors";
import { buildHealth } from "@/lib/health";
import { logIntegration } from "@/lib/logger";
import type {
  ServiceHealth,
  TatumTestDetails,
  WalrusAccountObjectSummary,
} from "@/types/infrastructure";

export interface SuiObjectResponse {
  data?: {
    objectId?: string;
    type?: string;
    owner?: unknown;
    content?: unknown;
  } | null;
  error?: unknown;
}

function formatOwner(owner: unknown): string | undefined {
  if (!owner) return undefined;
  if (typeof owner === "string") return owner;
  if (typeof owner === "object") {
    const entries = Object.entries(owner as Record<string, unknown>);
    if (entries.length === 1) {
      const [kind, value] = entries[0];
      if (typeof value === "string") return `${kind}:${value}`;
      return kind;
    }
  }
  return undefined;
}

export async function getSuiChainIdentifier(): Promise<string> {
  return suiRpc<string>("sui_getChainIdentifier", []);
}

export async function getLatestSuiCheckpoint(): Promise<string> {
  return suiRpc<string>("sui_getLatestCheckpointSequenceNumber", []);
}

/**
 * Look up the Walrus Memory account object on Sui mainnet. Returns `null` when
 * no `MEMWAL_ACCOUNT_ID` is configured.
 */
export async function getWalrusAccountObject(): Promise<WalrusAccountObjectSummary | null> {
  const objectId = process.env.MEMWAL_ACCOUNT_ID?.trim();
  if (!objectId) {
    return null;
  }

  const result = await suiRpc<SuiObjectResponse>("sui_getObject", [
    objectId,
    { showType: true, showOwner: true, showContent: true },
  ]);

  const data = result?.data ?? null;
  if (!data) {
    return { objectId, found: false };
  }

  return {
    objectId,
    found: true,
    type: data.type,
    owner: formatOwner(data.owner),
  };
}

export async function testTatumConnection(): Promise<
  ServiceHealth<TatumTestDetails>
> {
  const startedAt = Date.now();

  let rpcUrl: string;
  try {
    rpcUrl = getTatumEnv().TATUM_SUI_RPC_URL;
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "tatum",
      operation: "test_connection",
      ok: false,
      message: safe.message,
      code: safe.code,
    });
    return buildHealth({
      service: "tatum",
      status: "configuration_missing",
      message: safe.message,
      startedAt,
      details: { rpcUrl: "" },
      error: safe,
    });
  }

  try {
    const chainIdentifier = await getSuiChainIdentifier();
    const latestCheckpoint = await getLatestSuiCheckpoint();
    const accountObject = await getWalrusAccountObject();

    logIntegration({
      service: "tatum",
      operation: "test_connection",
      ok: true,
      message: "Sui mainnet RPC reachable via Tatum",
      durationMs: Date.now() - startedAt,
      meta: {
        chainIdentifier,
        latestCheckpoint,
        accountObjectFound: accountObject?.found ?? false,
      },
    });

    return buildHealth({
      service: "tatum",
      status: "connected",
      message: `Sui chain ${chainIdentifier} reachable at checkpoint ${latestCheckpoint}`,
      startedAt,
      details: { rpcUrl, chainIdentifier, latestCheckpoint, accountObject },
    });
  } catch (error) {
    const safe = toSafeError(error);
    logIntegration({
      service: "tatum",
      operation: "test_connection",
      ok: false,
      message: safe.message,
      code: safe.code,
      durationMs: Date.now() - startedAt,
    });
    return buildHealth({
      service: "tatum",
      status: "disconnected",
      message: safe.message,
      startedAt,
      details: { rpcUrl },
      error: safe,
    });
  }
}
