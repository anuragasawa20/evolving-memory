import { describe, expect, it } from "vitest";
import { parsePlaybookSynthesis } from "@/lib/playbook-synthesis";

const strategyId = "11111111-1111-4111-8111-111111111111";

describe("playbook synthesis parsing", () => {
  it("parses a valid, conditional playbook draft", () => {
    const raw = JSON.stringify({
      title: "ROI justification for unclear value",
      description: "Conditional guidance for price objections rooted in ROI.",
      guidance: "Co-create the ROI model with the buyer before presenting it.",
      whenToUse: "When the buyer understands the problem but not the value.",
      whenNotToUse: "When budget authority is absent.",
      suggestedQuestions: ["What metric matters to finance?"],
      exceptions: "Do not impose generic assumptions.",
      recommendedStrategyId: strategyId,
      confidence: 0.68,
    });

    const parsed = parsePlaybookSynthesis(raw);
    expect(parsed.title).toContain("ROI");
    expect(parsed.recommendedStrategyId).toBe(strategyId);
    expect(parsed.confidence).toBe(0.68);
    expect(parsed.suggestedQuestions).toHaveLength(1);
  });

  it("accepts fenced JSON and defaults a missing strategy id", () => {
    const raw = `\`\`\`json
{"title":"T","description":"D","guidance":"G","whenToUse":"W","whenNotToUse":"N","suggestedQuestions":[],"exceptions":"E","confidence":0.2}
\`\`\``;
    const parsed = parsePlaybookSynthesis(raw);
    expect(parsed.recommendedStrategyId).toBeUndefined();
  });

  it("rejects invalid playbook JSON", () => {
    expect(() => parsePlaybookSynthesis("not json")).toThrow(
      /did not contain valid JSON|failed validation/i,
    );
    expect(() =>
      parsePlaybookSynthesis(
        JSON.stringify({
          title: "T",
          description: "D",
          guidance: "G",
          whenToUse: "W",
          whenNotToUse: "N",
          suggestedQuestions: [],
          exceptions: "E",
          confidence: 2,
        }),
      ),
    ).toThrow(/failed validation/i);
  });
});
