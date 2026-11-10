import { describe, expect, it } from "vitest";
import {
  CASE_TAXONOMY,
  getCategoryForSubtype,
  isValidCaseClassification,
} from "@/lib/case-taxonomy";

describe("case taxonomy", () => {
  it("validates category and subtype pairs", () => {
    expect(
      isValidCaseClassification("PRICE_OBJECTION", "ROI_UNCLEAR"),
    ).toBe(true);
    expect(
      isValidCaseClassification("TRUST_AND_RISK", "MIGRATION"),
    ).toBe(true);
    expect(
      isValidCaseClassification("PRICE_OBJECTION", "MIGRATION"),
    ).toBe(false);
    expect(
      isValidCaseClassification("UNKNOWN_CATEGORY", "UNKNOWN_SUBTYPE"),
    ).toBe(false);
  });

  it("resolves a subtype to its parent category", () => {
    expect(getCategoryForSubtype("ROI_UNCLEAR")?.code).toBe("PRICE_OBJECTION");
    expect(getCategoryForSubtype("MIGRATION")?.code).toBe("TRUST_AND_RISK");
    expect(getCategoryForSubtype("NOT_REAL")).toBeNull();
  });

  it("keeps every configured subtype attached to a category", () => {
    for (const category of CASE_TAXONOMY) {
      expect(category.subtypes.length).toBeGreaterThan(0);
      for (const subtype of category.subtypes) {
        expect(
          isValidCaseClassification(category.code, subtype.code),
        ).toBe(true);
      }
    }
  });
});
