import { describe, expect, it } from "vitest";
import {
  createCallSchema,
  createDealSchema,
  updateDealSchema,
} from "@/lib/validation";

describe("deal validation", () => {
  it("accepts the ABC Fitness acceptance deal", () => {
    const parsed = createDealSchema.parse({
      customerName: "ABC Fitness",
      productName: "Gym Management Software",
      stage: "DISCOVERY",
      description: "Synthetic demo deal.",
    });

    expect(parsed.customerName).toBe("ABC Fitness");
    expect(parsed.stage).toBe("DISCOVERY");
    expect(parsed.status).toBe("ACTIVE");
  });

  it("rejects missing customer and invalid stage", () => {
    expect(
      createDealSchema.safeParse({
        customerName: "",
        productName: "Gym Management Software",
      }).success,
    ).toBe(false);

    expect(
      createDealSchema.safeParse({
        customerName: "ABC Fitness",
        productName: "Gym Management Software",
        stage: "PROSPECTING",
      }).success,
    ).toBe(false);
  });

  it("requires at least one field for an update", () => {
    expect(updateDealSchema.safeParse({}).success).toBe(false);
    expect(updateDealSchema.safeParse({ stage: "DEMO" }).success).toBe(true);
  });
});

describe("transcript validation", () => {
  it("accepts a reasonable synthetic transcript", () => {
    const parsed = createCallSchema.parse({
      transcript:
        "The gym owner already uses another management system. Payment follow-ups are manual.",
      title: "Discovery call",
      callDate: "2026-11-01",
    });
    expect(parsed.title).toBe("Discovery call");
    expect(parsed.callDate).toBeInstanceOf(Date);
  });

  it("rejects empty, short, and oversized transcripts", () => {
    expect(createCallSchema.safeParse({ transcript: "" }).success).toBe(false);
    expect(createCallSchema.safeParse({ transcript: "Too short" }).success).toBe(
      false,
    );
    expect(
      createCallSchema.safeParse({ transcript: "x".repeat(50_001) }).success,
    ).toBe(false);
  });
});
