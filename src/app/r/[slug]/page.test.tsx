import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIXTURE_NORMALIZED_SOURCE,
  FixtureRestaurantProvider,
} from "@/domain/generation/fixture-provider";
import type { Generation } from "@/domain/generation/types";

const findReadyBySlug = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/generation-repository", () => ({
  DrizzleGenerationRepository: class {
    findReadyBySlug = findReadyBySlug;
  },
}));

import PublishedRestaurantPage, { metadata } from "./page";

describe("published restaurant page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a sparse stored page without invoking the provider", async () => {
    const provider = new FixtureRestaurantProvider();
    const data = await provider.load(FIXTURE_NORMALIZED_SOURCE);
    const sparseData = {
      ...data,
      phone: null,
      website: null,
      hours: [],
      rating: null,
      reviewCount: null,
      reviews: [],
    };
    const load = vi.spyOn(FixtureRestaurantProvider.prototype, "load");
    findReadyBySlug.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      sourceUrl: FIXTURE_NORMALIZED_SOURCE,
      normalizedSource: FIXTURE_NORMALIZED_SOURCE,
      status: "ready",
      providerCheckpoint: data,
      publishedData: sparseData,
      slug: "las-palmeras",
      safeError: null,
      leaseToken: null,
      leaseAcquiredAt: null,
      attemptCount: 1,
      createdAt: new Date("2026-07-16T10:00:00.000Z"),
      updatedAt: new Date("2026-07-16T10:00:00.000Z"),
    } satisfies Generation);

    const page = await PublishedRestaurantPage({
      params: Promise.resolve({ slug: "las-palmeras" }),
    });
    const html = renderToStaticMarkup(page);

    expect(findReadyBySlug).toHaveBeenCalledWith("las-palmeras");
    expect(load).not.toHaveBeenCalled();
    expect(html).toContain("Restaurante Las Palmeras");
    expect(html).toContain(sparseData.category);
    expect(html).toContain(sparseData.description);
    expect(html).toContain(sparseData.city);
    expect(html).toContain(sparseData.address);
    expect(html).toContain("Ver en Google Maps");
    expect(html).toContain(sparseData.mapsUrl);
    expect(html).toContain("Información importada el");
    expect(html).toContain("Fuente: Google Maps");
    expect(html).toContain("No verificado por el restaurante");
    expect(html).not.toContain("Llamar");
    expect(html).not.toContain("reseñas");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
