import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env-schema";

const validEnv = {
  APIFY_PERSONAL_API_TOKEN: "apify-token",
  DATABASE_URL: "postgresql://user:password@example.com/limon",
  BLOB_READ_WRITE_TOKEN: "blob-token",
  AI_GATEWAY_API_KEY: "ai-token",
};

describe("server environment contract", () => {
  it("returns exactly the four server-only variables", () => {
    expect(
      parseServerEnv({ ...validEnv, NEXT_PUBLIC_DATABASE_URL: "leak" }),
    ).toEqual(validEnv);
  });

  it("rejects a missing secret", () => {
    expect(() =>
      parseServerEnv({ ...validEnv, AI_GATEWAY_API_KEY: undefined }),
    ).toThrow();
  });
});
