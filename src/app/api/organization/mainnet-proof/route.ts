import { connection, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import {
  getLatestSuiCheckpoint,
  getSuiChainIdentifier,
  getWalrusAccountObject,
} from "@/services/tatum.service";

export const maxDuration = 60;

export async function GET() {
  await connection();
  try {
    const [chainIdentifier, latestCheckpoint, account] = await Promise.all([
      getSuiChainIdentifier(),
      getLatestSuiCheckpoint(),
      getWalrusAccountObject(),
    ]);

    return NextResponse.json({
      chainIdentifier,
      latestCheckpoint,
      account,
      checkedAt: new Date().toISOString(),
      provider: "Tatum Sui Mainnet RPC",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
