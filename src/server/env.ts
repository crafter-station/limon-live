import "server-only";
import { parseServerEnv } from "./env-schema";

let cachedEnv: ReturnType<typeof parseServerEnv> | undefined;

export function getServerEnv() {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
