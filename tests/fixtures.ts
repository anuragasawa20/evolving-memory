import type { CallAnalysis } from "@/lib/call-analysis";

export const validAnalysis: CallAnalysis = {
  summary:
    "The gym owner uses another management system and manually follows up on overdue payments.",
  painPoints: [
    {
      content: "Payment follow-ups are mostly manual and consume staff time.",
      evidence:
        "They explained that payment follow-ups are mostly manual and that staff spend time contacting customers about overdue memberships.",
    },
  ],
  objections: [
    {
      content: "The owner may be concerned about switching systems.",
      severity: "MEDIUM",
      evidence: "The owner already uses another management system.",
    },
  ],
  buyingSignals: [
    {
      content: "They want to understand whether automation is possible.",
      evidence:
        "They are interested in understanding whether our product can automate this process.",
    },
  ],
  requirements: [
    { content: "Automate overdue payment follow-ups." },
  ],
  commitments: [],
  stakeholders: [
    { name: "Gym owner", role: "Owner", involvement: "Primary contact" },
  ],
  budgetInformation: [],
  timelineInformation: [],
  decisionCriteria: ["Automation of payment follow-ups"],
  unresolvedQuestions: ["Can the product replace their existing system?"],
  suggestedStage: "Discovery",
  stageReasoning:
    "The customer is still understanding capabilities and has not committed.",
};

export function analysisJson(): string {
  return JSON.stringify(validAnalysis);
}
