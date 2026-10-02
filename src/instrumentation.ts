import { assertRequiredServerEnv } from "./server/env-schema";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertRequiredServerEnv();
  }
}
