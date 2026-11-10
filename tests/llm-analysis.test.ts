import { beforeEach, describe, expect, it, vi } from "vitest";
import { analysisJson } from "./fixtures";

vi.mock("@/lib/llm", () => ({
  getLlmEnv: vi.fn(() => ({ OPENROUTER_MODEL: "test-model" })),
  getLlmClient: vi.fn(),
}));

import { getLlmClient } from "@/lib/llm";
import { analyzeTranscript } from "@/services/llm.service";
import { IntegrationError } from "@/lib/errors";

function completion(content: string) {
  return {
    model: "test-model",
    choices: [{ message: { content } }],
  };
}

function fakeClient(contents: string[]) {
  const create = vi.fn();
  for (const content of contents) {
    create.mockResolvedValueOnce(completion(content));
  }
  return { chat: { completions: { create } } };
}

describe("analyzeTranscript", () => {
  beforeEach(() => {
    vi.mocked(getLlmClient).mockReset();
  });

  it("returns validated analysis on the first response", async () => {
    const client = fakeClient([analysisJson()]);
    vi.mocked(getLlmClient).mockReturnValue(
      client as unknown as ReturnType<typeof getLlmClient>,
    );

    const result = await analyzeTranscript("A synthetic sales call transcript.");

    expect(result.suggestedStage).toBe("Discovery");
    expect(client.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({ response_format: { type: "json_object" } }),
      expect.any(Object),
    );
  });

  it("retries once with a correction prompt after invalid JSON", async () => {
    const client = fakeClient(["not json", analysisJson()]);
    vi.mocked(getLlmClient).mockReturnValue(
      client as unknown as ReturnType<typeof getLlmClient>,
    );

    const result = await analyzeTranscript("A synthetic sales call transcript.");

    expect(result.summary).toContain("gym owner");
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);

    const secondMessages =
      client.chat.completions.create.mock.calls[1][0].messages;
    expect(
      secondMessages.some(
        (message: { role: string; content: string }) =>
          message.role === "user" &&
          /corrected JSON/i.test(String(message.content)),
      ),
    ).toBe(true);
  });

  it("returns an explicit error after two invalid responses", async () => {
    const client = fakeClient(["not json", "still not json"]);
    vi.mocked(getLlmClient).mockReturnValue(
      client as unknown as ReturnType<typeof getLlmClient>,
    );

    await expect(
      analyzeTranscript("A synthetic sales call transcript."),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("does not mistake a valid-looking partial object for success", async () => {
    const client = fakeClient([
      JSON.stringify({ summary: "Only a summary" }),
      JSON.stringify({ summary: "Only a summary" }),
    ]);
    vi.mocked(getLlmClient).mockReturnValue(
      client as unknown as ReturnType<typeof getLlmClient>,
    );

    const error = await analyzeTranscript(
      "A synthetic sales call transcript.",
    ).catch((cause) => cause);

    expect(error).toBeInstanceOf(IntegrationError);
    expect(error.code).toBe("INVALID_RESPONSE");
  });
});
