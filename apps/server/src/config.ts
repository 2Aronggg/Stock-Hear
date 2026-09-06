import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  KIS_APP_KEY: z.string().optional(),
  KIS_APP_SECRET: z.string().optional(),
  KIS_REST_BASE_URL: z.string().url().optional(),
  KIS_WEBSOCKET_URL: z.string().url().optional(),
  KIS_ENVIRONMENT: z.enum(["real", "virtual"]).default("real"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  REPLAY_SAMPLE_WRITE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const invalidFields = parsedEnv.error.issues.map((issue) => issue.path.join("."));
  throw new Error(`Invalid server environment variables: ${invalidFields.join(", ")}`);
}

export const config = parsedEnv.data;

export const hasKisCredentials = (): boolean => Boolean(config.KIS_APP_KEY && config.KIS_APP_SECRET);

