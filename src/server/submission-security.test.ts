import { describe, expect, it } from "vitest";
import {
  deriveRequesterKey,
  getRequesterAddress,
  utcHour,
} from "./submission-security";

describe("submission security", () => {
  it("derives a stable non-reversible requester key without retaining the address", () => {
    const first = deriveRequesterKey("203.0.113.8", "postgres://credential");
    const duplicate = deriveRequesterKey(
      "203.0.113.8",
      "postgres://credential",
    );
    const afterCredentialRotation = deriveRequesterKey(
      "203.0.113.8",
      "postgres://rotated-credential",
    );

    expect(first).toBe(duplicate);
    expect(afterCredentialRotation).not.toBe(first);
    expect(first).toHaveLength(64);
    expect(first).not.toContain("203.0.113.8");
  });

  it("uses the first proxy-provided address and falls back without throwing", () => {
    expect(
      getRequesterAddress(
        new Headers({
          "x-vercel-forwarded-for": "203.0.113.8, 10.0.0.1",
          "x-forwarded-for": "198.51.100.4",
        }),
      ),
    ).toBe("203.0.113.8");
    expect(
      getRequesterAddress(
        new Headers({ "x-vercel-forwarded-for": "spoofed-value" }),
      ),
    ).toBe("unknown");
    expect(
      getRequesterAddress(new Headers({ "x-forwarded-for": "198.51.100.4" })),
    ).toBe("unknown");
    expect(getRequesterAddress(new Headers())).toBe("unknown");
  });

  it("creates UTC hourly buckets", () => {
    expect(utcHour(new Date("2026-07-16T10:59:59.999Z"))).toEqual(
      new Date("2026-07-16T10:00:00.000Z"),
    );
  });
});
