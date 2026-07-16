import { describe, expect, it, vi } from "vitest";
import type { Generation } from "@/domain/generation/types";

const findById = vi.hoisted(() => vi.fn());
vi.mock("@/server/db/generation-repository", () => ({
  DrizzleGenerationRepository: class {
    findById = findById;
  },
}));

import { GET } from "./route";

const id = "00000000-0000-4000-8000-000000000001";

describe("generation status route", () => {
  it("validates IDs and disables caching", async () => {
    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(findById).not.toHaveBeenCalled();
  });

  it("returns only safe public failure fields", async () => {
    findById.mockResolvedValue({
      id,
      status: "failed",
      slug: "private-slug",
      safeError: "Please try again.",
      sourceUrl: "secret source",
    } as Generation);
    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ id }),
    });

    expect(await response.json()).toEqual({
      status: "failed",
      slug: null,
      error: "Please try again.",
    });
  });
});
