import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationFailedError } from "@/domain/generation/coordinator";
import type { Generation } from "@/domain/generation/types";

const findById = vi.hoisted(() => vi.fn());
const advance = vi.hoisted(() => vi.fn());
vi.mock("@/server/db/generation-repository", () => ({
  DrizzleGenerationRepository: class {
    findById = findById;
  },
}));
vi.mock("@/server/generation-service", () => ({
  createGenerationCoordinator: () => ({ advance }),
}));

import { POST } from "./progress/route";
import { GET } from "./route";

const id = "00000000-0000-4000-8000-000000000001";

afterEach(() => {
  vi.clearAllMocks();
});

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

  it("returns an exact no-store response for a valid unknown ID", async () => {
    findById.mockResolvedValue(null);

    const response = await GET(new Request("http://test"), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Generation not found.",
    });
  });
});

describe("generation progress route", () => {
  it("returns an exact no-store response for a valid unknown ID", async () => {
    advance.mockRejectedValue(new Error("Missing generation"));
    findById.mockResolvedValue(null);

    const response = await POST(
      new Request("http://test", { method: "POST" }),
      {
        params: Promise.resolve({ id }),
      },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Generation not found.",
    });
  });

  it("returns only persisted safe fields after a generation failure", async () => {
    advance.mockRejectedValue(new GenerationFailedError("Provider secret"));
    findById.mockResolvedValue({
      id,
      status: "failed",
      slug: "private-slug",
      safeError: "We couldn't finish your site right now. Please try again.",
      sourceUrl: "secret source",
      providerCheckpoint: { private: "provider data" },
      leaseToken: "secret lease",
    } as unknown as Generation);

    const response = await POST(
      new Request("http://test", { method: "POST" }),
      {
        params: Promise.resolve({ id }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "failed",
      slug: null,
      error: "We couldn't finish your site right now. Please try again.",
    });
    expect(findById).toHaveBeenCalledTimes(1);
  });
});
