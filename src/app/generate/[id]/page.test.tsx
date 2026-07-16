import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Generation } from "@/domain/generation/types";

const findById = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/generation-repository", () => ({
  DrizzleGenerationRepository: class {
    findById = findById;
  },
}));

import GenerationPage from "./page";

describe("generation page", () => {
  it("renders the resumable client progress experience", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    findById.mockResolvedValue({
      id,
      sourceUrl: "https://example.com/maps",
      normalizedSource: "https://example.com/maps",
      status: "generating",
      providerCheckpoint: null,
      publishedData: null,
      slug: null,
      safeError: null,
      leaseToken: "00000000-0000-4000-8000-000000000002",
      leaseAcquiredAt: new Date("2026-07-16T10:00:00.000Z"),
      attemptCount: 3,
      createdAt: new Date("2026-07-16T10:00:00.000Z"),
      updatedAt: new Date("2026-07-16T10:00:00.000Z"),
    } satisfies Generation);

    const page = await GenerationPage({
      params: Promise.resolve({ id }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Keep this page open");
    expect(html).toContain("Building your page");
    expect(html).toContain("Creating your site");
  });
});
