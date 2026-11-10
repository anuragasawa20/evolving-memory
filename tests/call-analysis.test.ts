import { describe, expect, it } from "vitest";
import {
  analysisToFactInputs,
  normalizeSuggestedStage,
  parseCallAnalysis,
} from "@/lib/call-analysis";
import { IntegrationError } from "@/lib/errors";
import { analysisJson, validAnalysis } from "./fixtures";

describe("LLM response parsing", () => {
  it("parses a valid JSON response", () => {
    const parsed = parseCallAnalysis(analysisJson());
    expect(parsed.summary).toBe(validAnalysis.summary);
    expect(parsed.painPoints).toHaveLength(1);
  });

  it("parses JSON wrapped in a markdown fence or prose", () => {
    const fenced = `\`\`\`json\n${analysisJson()}\n\`\`\``;
    expect(parseCallAnalysis(fenced).summary).toBe(validAnalysis.summary);

    const prose = `Here you go:\n${analysisJson()}\nDone.`;
    expect(parseCallAnalysis(prose).summary).toBe(validAnalysis.summary);
  });

  it("rejects missing fields and invalid objection severity", () => {
    expect(() => parseCallAnalysis("{}")).toThrow(IntegrationError);

    const invalid = JSON.parse(analysisJson());
    invalid.objections[0].severity = "CRITICAL";
    expect(() => parseCallAnalysis(JSON.stringify(invalid))).toThrow(
      IntegrationError,
    );
  });

  it("rejects empty model output", () => {
    expect(() => parseCallAnalysis("   ")).toThrow(
      /empty response/i,
    );
  });
});

describe("analysis normalization", () => {
  it("normalizes suggested stage values", () => {
    expect(normalizeSuggestedStage("Discovery")).toBe("DISCOVERY");
    expect(normalizeSuggestedStage("negotiation")).toBe("NEGOTIATION");
    expect(normalizeSuggestedStage("not-a-stage")).toBeNull();
  });

  it("maps analysis into categorized facts with evidence metadata", () => {
    const facts = analysisToFactInputs(validAnalysis);
    expect(facts.some((fact) => fact.category === "PAIN_POINT")).toBe(true);
    expect(facts.some((fact) => fact.category === "BUYING_SIGNAL")).toBe(true);
    expect(facts.some((fact) => fact.category === "STAKEHOLDER")).toBe(true);
    expect(
      facts.some(
        (fact) =>
          fact.category === "OBJECTION" &&
          fact.metadata?.severity === "MEDIUM",
      ),
    ).toBe(true);
    expect(
      facts.find((fact) => fact.category === "PAIN_POINT")?.evidence,
    ).toContain("payment follow-ups");
  });
});
