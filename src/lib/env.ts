import { z } from "zod";
import { ConfigurationError } from "./errors";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const required = (name: string) =>
  z.preprocess(emptyToUndefined, z.string().min(1, `${name} is required`));

const withDefault = (fallback: string) =>
  z.preprocess(emptyToUndefined, z.string().min(1).default(fallback));

export const databaseEnvSchema = z.object({
  DATABASE_URL: required("DATABASE_URL"),
});

export const llmEnvSchema = z.object({
  OPENROUTER_API_KEY: required("OPENROUTER_API_KEY"),
  OPENROUTER_BASE_URL: withDefault("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: withDefault("nvidia/nemotron-3-super-120b-a12b"),
});

export const memoryEnvSchema = z.object({
  MEMWAL_PRIVATE_KEY: required("MEMWAL_PRIVATE_KEY"),
  MEMWAL_ACCOUNT_ID: required("MEMWAL_ACCOUNT_ID"),
  MEMWAL_SERVER_URL: withDefault("https://relayer.memory.walrus.xyz"),
  MEMWAL_NAMESPACE: withDefault("dealos_demo_deals"),
  MEMWAL_ORGANIZATION_NAMESPACE: withDefault("dealos_demo_organization"),
  MEMWAL_LEARNING_NAMESPACE: withDefault("dealos_demo_learning"),
});

export const tatumEnvSchema = z.object({
  TATUM_API_KEY: required("TATUM_API_KEY"),
  TATUM_SUI_RPC_URL: withDefault("https://sui-mainnet.gateway.tatum.io"),
});

export const envSchemas = {
  database: databaseEnvSchema,
  llm: llmEnvSchema,
  memory: memoryEnvSchema,
  tatum: tatumEnvSchema,
} as const;

export type EnvGroup = keyof typeof envSchemas;

export const MEMORY_NAMESPACES = {
  deals: "dealos_demo_deals",
  learning: "dealos_demo_learning",
  organization: "dealos_demo_organization",
} as const;

export function loadEnv<G extends EnvGroup>(
  group: G,
):
  | { ok: true; data: z.infer<(typeof envSchemas)[G]> }
  | { ok: false; missing: string[] } {
  const schema = envSchemas[group];
  const result = schema.safeParse(process.env);
  if (result.success) {
    return {
      ok: true,
      data: result.data as z.infer<(typeof envSchemas)[G]>,
    };
  }

  const missing = Array.from(
    new Set(
      result.error.issues.map((issue) => issue.path.join(".") || "environment"),
    ),
  );
  return { ok: false, missing };
}

export function assertEnv<G extends EnvGroup>(
  group: G,
): z.infer<(typeof envSchemas)[G]> {
  const result = loadEnv(group);
  if (!result.ok) {
    throw new ConfigurationError(group, result.missing);
  }
  return result.data;
}
