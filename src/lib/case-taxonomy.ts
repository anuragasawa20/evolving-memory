import { z } from "zod";

export interface CaseSubtypeDefinition {
  code: string;
  name: string;
}

export interface CaseCategoryDefinition {
  code: string;
  name: string;
  description: string;
  subtypes: CaseSubtypeDefinition[];
}

export const CASE_TAXONOMY: CaseCategoryDefinition[] = [
  {
    code: "PRICE_OBJECTION",
    name: "Price objection",
    description:
      "The customer questions price, budget or the financial case for buying.",
    subtypes: [
      { code: "TOO_EXPENSIVE", name: "Too expensive" },
      { code: "BUDGET_UNAVAILABLE", name: "Budget unavailable" },
      { code: "COMPETITOR_CHEAPER", name: "Competitor is cheaper" },
      { code: "ROI_UNCLEAR", name: "ROI is unclear" },
      { code: "PRICING_MODEL_MISMATCH", name: "Pricing model mismatch" },
    ],
  },
  {
    code: "COMPETITOR_COMPARISON",
    name: "Competitor comparison",
    description:
      "The customer is evaluating another provider or comparing alternatives.",
    subtypes: [
      { code: "FEATURE_COMPARISON", name: "Feature comparison" },
      { code: "INCUMBENT_LOYALTY", name: "Incumbent loyalty" },
      { code: "SWITCHING_COST", name: "Switching cost" },
      { code: "PROOF_REQUIRED", name: "Proof required" },
    ],
  },
  {
    code: "STATUS_QUO_RESISTANCE",
    name: "Status quo resistance",
    description:
      "The customer prefers the current software, manual process or way of working.",
    subtypes: [
      { code: "HABIT", name: "Habit" },
      { code: "EXISTING_PROCESS", name: "Existing process works well enough" },
      { code: "CHANGE_FATIGUE", name: "Change fatigue" },
      { code: "NO_BURNING_PLATFORM", name: "No burning platform" },
    ],
  },
  {
    code: "TRUST_AND_RISK",
    name: "Trust and risk",
    description:
      "Security, migration, reliability, compliance or privacy concerns.",
    subtypes: [
      { code: "SECURITY", name: "Security" },
      { code: "MIGRATION", name: "Migration risk" },
      { code: "RELIABILITY", name: "Reliability" },
      { code: "COMPLIANCE", name: "Compliance" },
      { code: "DATA_PRIVACY", name: "Data privacy" },
    ],
  },
  {
    code: "LACK_OF_URGENCY",
    name: "Lack of urgency",
    description:
      "The customer is interested but not prioritizing the purchase.",
    subtypes: [
      { code: "NO_DEADLINE", name: "No deadline" },
      { code: "LOW_PRIORITY", name: "Low priority" },
      { code: "WAITING_FOR_BUDGET", name: "Waiting for budget" },
      { code: "INTERNAL_ALIGNMENT", name: "Internal alignment pending" },
    ],
  },
  {
    code: "STAKEHOLDER_CHALLENGE",
    name: "Stakeholder challenge",
    description:
      "Decision-maker access, internal disagreement or procurement friction.",
    subtypes: [
      { code: "DECISION_MAKER_UNAVAILABLE", name: "Decision-maker unavailable" },
      { code: "INTERNAL_DISAGREEMENT", name: "Internal disagreement" },
      { code: "CHAMPION_MISSING", name: "Champion missing" },
      { code: "PROCUREMENT_BLOCK", name: "Procurement block" },
    ],
  },
  {
    code: "PRODUCT_GAP",
    name: "Product gap",
    description:
      "Requested functionality, integration or scale is not available.",
    subtypes: [
      { code: "MISSING_FEATURE", name: "Missing feature" },
      { code: "INTEGRATION_GAP", name: "Integration gap" },
      { code: "SCALABILITY_LIMIT", name: "Scalability limit" },
      { code: "CUSTOMIZATION_GAP", name: "Customization gap" },
    ],
  },
  {
    code: "LOW_ENGAGEMENT",
    name: "Low engagement",
    description:
      "No response, delayed meetings, stalled deal or a disengaged buyer.",
    subtypes: [
      { code: "NO_RESPONSE", name: "No response" },
      { code: "DELAYED_MEETING", name: "Delayed meeting" },
      { code: "STALLED_DEAL", name: "Stalled deal" },
      { code: "GHOSTING", name: "Ghosting" },
    ],
  },
  {
    code: "NEGOTIATION",
    name: "Negotiation",
    description:
      "Discounts, contract terms, payment conditions or procurement terms.",
    subtypes: [
      { code: "DISCOUNT_REQUEST", name: "Discount request" },
      { code: "CONTRACT_TERMS", name: "Contract terms" },
      { code: "PAYMENT_CONDITIONS", name: "Payment conditions" },
      { code: "PROCUREMENT_TERMS", name: "Procurement terms" },
    ],
  },
  {
    code: "BUYING_SIGNAL",
    name: "Buying signal",
    description:
      "The customer requests implementation details, pricing or next steps.",
    subtypes: [
      { code: "IMPLEMENTATION_DETAILS", name: "Implementation details" },
      { code: "PRICING_REQUEST", name: "Pricing request" },
      { code: "NEXT_STEPS", name: "Next steps requested" },
      { code: "REFERRAL", name: "Referral or expansion signal" },
    ],
  },
];

export const CASE_CATEGORY_CODES = CASE_TAXONOMY.map(
  (category) => category.code,
) as [string, ...string[]];

export const CASE_SUBTYPE_CODES = CASE_TAXONOMY.flatMap((category) =>
  category.subtypes.map((subtype) => subtype.code),
) as [string, ...string[]];

export const caseCategoryCodeSchema = z.enum(CASE_CATEGORY_CODES);
export const caseSubtypeCodeSchema = z.enum(CASE_SUBTYPE_CODES);

export const STRATEGY_TYPES = [
  "ROI_JUSTIFICATION",
  "PHASED_IMPLEMENTATION",
  "VALUE_DIFFERENTIATION",
  "DISCOVERY_FIRST",
  "SECURITY_PROOF",
  "STAKEHOLDER_ALIGNMENT",
  "URGENCY_CREATION",
  "NEGOTIATION_TRADEOFF",
  "COMPETITIVE_PROOF",
  "CUSTOM_DEMO",
  "OTHER",
] as const;

export const STRATEGY_TYPE_LABELS: Record<string, string> = {
  ROI_JUSTIFICATION: "ROI justification",
  PHASED_IMPLEMENTATION: "Phased implementation",
  VALUE_DIFFERENTIATION: "Value differentiation",
  DISCOVERY_FIRST: "Discovery first",
  SECURITY_PROOF: "Security proof",
  STAKEHOLDER_ALIGNMENT: "Stakeholder alignment",
  URGENCY_CREATION: "Urgency creation",
  NEGOTIATION_TRADEOFF: "Negotiation trade-off",
  COMPETITIVE_PROOF: "Competitive proof",
  CUSTOM_DEMO: "Custom demo",
  OTHER: "Other",
};

export const CASE_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const OUTCOME_TYPES = [
  "POSITIVE_RESPONSE",
  "MEETING_BOOKED",
  "DEMO_ACCEPTED",
  "PROPOSAL_REQUESTED",
  "OBJECTION_RESOLVED",
  "DEAL_ADVANCED",
  "DEAL_WON",
  "DEAL_LOST",
  "NO_CHANGE",
  "UNKNOWN",
] as const;

export const OUTCOME_LABELS: Record<string, string> = {
  POSITIVE_RESPONSE: "Positive response",
  MEETING_BOOKED: "Meeting booked",
  DEMO_ACCEPTED: "Demo accepted",
  PROPOSAL_REQUESTED: "Proposal requested",
  OBJECTION_RESOLVED: "Objection resolved",
  DEAL_ADVANCED: "Deal advanced",
  DEAL_WON: "Deal won",
  DEAL_LOST: "Deal lost",
  NO_CHANGE: "No change",
  UNKNOWN: "Unknown",
};

export const POSITIVE_OUTCOMES = new Set([
  "POSITIVE_RESPONSE",
  "MEETING_BOOKED",
  "DEMO_ACCEPTED",
  "PROPOSAL_REQUESTED",
  "OBJECTION_RESOLVED",
  "DEAL_ADVANCED",
  "DEAL_WON",
]);

export const NEGATIVE_OUTCOMES = new Set(["DEAL_LOST"]);

export function getCategoryDefinition(code: string) {
  return CASE_TAXONOMY.find((category) => category.code === code) ?? null;
}

export function getSubtypeDefinition(categoryCode: string, subtypeCode: string) {
  return (
    getCategoryDefinition(categoryCode)?.subtypes.find(
      (subtype) => subtype.code === subtypeCode,
    ) ?? null
  );
}

export function isValidCaseClassification(
  categoryCode: string,
  subtypeCode: string,
): boolean {
  return Boolean(getSubtypeDefinition(categoryCode, subtypeCode));
}

export function getCategoryForSubtype(subtypeCode: string) {
  return (
    CASE_TAXONOMY.find((category) =>
      category.subtypes.some((subtype) => subtype.code === subtypeCode),
    ) ?? null
  );
}
