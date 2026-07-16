import { z } from "zod";

const serverEnvSchema = z.object({
  APIFY_PERSONAL_API_TOKEN: z.string().min(1),
  DATABASE_URL: z.url().startsWith("postgres"),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  AI_GATEWAY_API_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  env: Readonly<Record<string, string | undefined>>,
): ServerEnv {
  return serverEnvSchema.parse({
    APIFY_PERSONAL_API_TOKEN: env.APIFY_PERSONAL_API_TOKEN,
    DATABASE_URL: env.DATABASE_URL,
    BLOB_READ_WRITE_TOKEN: env.BLOB_READ_WRITE_TOKEN,
    AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY,
  });
}
