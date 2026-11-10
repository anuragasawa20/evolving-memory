import { describe, expect, it } from "vitest";
import { testMemoryReadWrite } from "@/services/memory.service";

const enabled = process.env.RUN_WALRUS_INTEGRATION === "1";

describe.skipIf(!enabled)("Walrus Memory Mainnet integration", () => {
  it(
    "writes a synthetic memory and recalls it from Mainnet",
    async () => {
      const result = await testMemoryReadWrite();

      expect(result.status).toBe("connected");
      expect(result.details?.write?.blobId).toBeTruthy();
      expect(result.details?.recall?.relevant).toBe(true);
    },
    180_000,
  );
});
