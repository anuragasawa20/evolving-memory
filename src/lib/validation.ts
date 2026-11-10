import { z } from "zod";

export const DEAL_STAGES = [
  "DISCOVERY",
  "QUALIFICATION",
  "DEMO",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSING",
  "WON",
  "LOST",
] as const;

export const DEAL_STATUSES = ["ACTIVE", "WON", "LOST"] as const;

export const FACT_CATEGORIES = [
  "PAIN_POINT",
  "OBJECTION",
  "BUYING_SIGNAL",
  "REQUIREMENT",
  "COMMITMENT",
  "STAKEHOLDER",
  "BUDGET",
  "TIMELINE",
  "DECISION_CRITERIA",
  "OTHER",
] as const;

export const dealStageSchema = z.enum(DEAL_STAGES);
export const dealStatusSchema = z.enum(DEAL_STATUSES);
export const factCategorySchema = z.enum(FACT_CATEGORIES);

export const MAX_TRANSCRIPT_LENGTH = 50_000;
export const MIN_TRANSCRIPT_LENGTH = 20;

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max).optional(),
  );

export const createDealSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required").max(160),
  productName: z.string().trim().min(1, "Product name is required").max(160),
  description: optionalText(4_000),
  stage: dealStageSchema.optional().default("DISCOVERY"),
  status: dealStatusSchema.optional().default("ACTIVE"),
});

export const updateDealSchema = z
  .object({
    customerName: z.string().trim().min(1).max(160).optional(),
    productName: z.string().trim().min(1).max(160).optional(),
    description: optionalText(4_000).nullable().optional(),
    stage: dealStageSchema.optional(),
    status: dealStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const createCallSchema = z.object({
  transcript: z
    .string()
    .trim()
    .min(
      MIN_TRANSCRIPT_LENGTH,
      `Transcript must be at least ${MIN_TRANSCRIPT_LENGTH} characters`,
    )
    .max(
      MAX_TRANSCRIPT_LENGTH,
      `Transcript must be at most ${MAX_TRANSCRIPT_LENGTH} characters`,
    ),
  title: optionalText(200),
  callDate: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.date().optional(),
  ),
});

export const recallQuerySchema = z.object({
  query: z.string().trim().min(2, "Query is required").max(500),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export const createTechniqueSchema = z.object({
  name: z.string().trim().min(1, "Technique name is required").max(200),
  description: z
    .string()
    .trim()
    .min(1, "Technique description is required")
    .max(4_000),
  source: optionalText(300),
  memoryId: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.string().uuid().optional(),
  ),
});

export const updateRecommendationSchema = z.object({
  status: z.enum([
    "SUGGESTED",
    "ACCEPTED",
    "MODIFIED",
    "DISMISSED",
    "EXECUTED",
    "OUTCOME_PENDING",
    "OUTCOME_RECORDED",
  ]),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type CreateCallInput = z.infer<typeof createCallSchema>;
export type RecallQueryInput = z.infer<typeof recallQuerySchema>;
export type CreateTechniqueInput = z.infer<typeof createTechniqueSchema>;
export type UpdateRecommendationInput = z.infer<
  typeof updateRecommendationSchema
>;

export function zodIssues(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "root",
    message: issue.message,
  }));
}
