import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RestaurantSite } from "@/components/restaurant-site";
import { MemoryGenerationRepository } from "@/test/memory-generation-repository";
import { generationRepositoryContract } from "@/test/generation-repository-contract";
import { GenerationCoordinator, restaurantSlug } from "./coordinator";
import {
  FIXTURE_MAPS_URL,
  FixtureRestaurantProvider,
} from "./fixture-provider";
import { ApifyGoogleMapsProvider } from "./live-provider";

describe("fixture generation golden path", () => {
  it("creates stable, non-empty, venue-specific slugs", () => {
    expect(
      restaurantSlug("東京食堂", "https://maps.google.com/place/one"),
    ).toMatch(/^restaurante-[a-f0-9]{10}$/);
    expect(
      restaurantSlug("Casa Sol", "https://maps.google.com/place/one"),
    ).not.toBe(restaurantSlug("Casa Sol", "https://maps.google.com/place/two"));
    expect(
      restaurantSlug("Casa Sol", "https://maps.google.com/place/one"),
    ).toBe(restaurantSlug("Casa Sol", "https://maps.google.com/place/one"));
  });
  it("persists and reuses equivalent pending submissions", async () => {
    const repository = new MemoryGenerationRepository();
    const coordinator = new GenerationCoordinator(
      repository,
      new FixtureRestaurantProvider(),
    );

    const first = await coordinator.submit(
      `${FIXTURE_MAPS_URL}?utm_source=test`,
    );
    const duplicate = await coordinator.submit(FIXTURE_MAPS_URL);

    expect(first.kind).toBe("generation");
    expect(duplicate).toEqual(first);
    const persisted = await repository.findById(
      first.kind === "generation" ? first.id : "",
    );
    expect(persisted).toMatchObject({ status: "pending", attemptCount: 0 });
  });

  it("finalizes a stale interrupted third attempt", async () => {
    const repository = new MemoryGenerationRepository();
    let now = new Date("2026-07-16T10:00:00.000Z");
    const coordinator = new GenerationCoordinator(
      repository,
      new FixtureRestaurantProvider(),
      () => now,
    );
    const submission = await coordinator.submit(FIXTURE_MAPS_URL);
    if (submission.kind !== "generation")
      throw new Error("Expected generation");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      repository.interruptNextPublication();
      expect(await coordinator.advance(submission.id)).toEqual({
        kind: "generating",
        id: submission.id,
      });
      now = new Date(now.getTime() + 120_000);
    }

    expect(await coordinator.advance(submission.id)).toEqual({
      kind: "failed",
      id: submission.id,
    });
    expect(await repository.findById(submission.id)).toMatchObject({
      status: "failed",
      attemptCount: 3,
      leaseToken: null,
    });
  });

  it("checkpoints, publishes, and renders only normalized stored data", async () => {
    const repository = new MemoryGenerationRepository();
    const provider = new FixtureRestaurantProvider();
    const load = vi.spyOn(provider, "load");
    const coordinator = new GenerationCoordinator(repository, provider);
    const submission = await coordinator.submit(FIXTURE_MAPS_URL);
    if (submission.kind !== "generation")
      throw new Error("Expected generation");

    const result = await coordinator.advance(submission.id);
    const persisted = await repository.findById(submission.id);

    expect(result).toEqual({
      kind: "ready",
      slug: restaurantSlug("Restaurante Las Palmeras", FIXTURE_MAPS_URL),
    });
    expect(persisted).toMatchObject({
      status: "ready",
      slug: restaurantSlug("Restaurante Las Palmeras", FIXTURE_MAPS_URL),
      attemptCount: 1,
      providerCheckpoint: { name: "Restaurante Las Palmeras" },
      publishedData: { city: "Lima" },
    });
    expect(load).toHaveBeenCalledOnce();

    if (!persisted?.publishedData)
      throw new Error("Expected stored publication");
    const html = renderToStaticMarkup(
      <RestaurantSite restaurant={persisted.publishedData} />,
    );
    expect(html).toContain("Restaurante Las Palmeras");
    expect(html).toContain("Visítanos");
    expect(html).toContain("No verificado por el restaurante");
    expect(load).toHaveBeenCalledOnce();
  });

  it("sends a ready duplicate directly to the stored slug without provider work", async () => {
    const repository = new MemoryGenerationRepository();
    const provider = new FixtureRestaurantProvider();
    const load = vi.spyOn(provider, "load");
    const coordinator = new GenerationCoordinator(repository, provider);
    const first = await coordinator.submit(FIXTURE_MAPS_URL);
    if (first.kind !== "generation") throw new Error("Expected generation");
    await coordinator.advance(first.id);

    const duplicate = await coordinator.submit(`${FIXTURE_MAPS_URL}#reviews`);

    expect(duplicate).toEqual({
      kind: "ready",
      slug: restaurantSlug("Restaurante Las Palmeras", FIXTURE_MAPS_URL),
    });
    expect(load).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resumes from a durable checkpoint without repeating provider work", async () => {
    const repository = new MemoryGenerationRepository();
    const provider = new FixtureRestaurantProvider();
    const load = vi.spyOn(provider, "load");
    let now = new Date("2026-07-16T10:00:00.000Z");
    const coordinator = new GenerationCoordinator(
      repository,
      provider,
      () => now,
    );
    const submission = await coordinator.submit(FIXTURE_MAPS_URL);
    if (submission.kind !== "generation")
      throw new Error("Expected generation");
    repository.interruptNextPublication();

    expect(await coordinator.advance(submission.id)).toEqual({
      kind: "generating",
      id: submission.id,
    });
    now = new Date("2026-07-16T10:02:00.000Z");
    expect(await coordinator.advance(submission.id)).toEqual({
      kind: "ready",
      slug: restaurantSlug("Restaurante Las Palmeras", FIXTURE_MAPS_URL),
    });
    expect(load).toHaveBeenCalledOnce();
  });

  it("reuses an Apify-backed paid checkpoint after publication interruption", async () => {
    const repository = new MemoryGenerationRepository();
    const paidFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              title: "Las Palmeras",
              categoryName: "Restaurante peruano",
              address: "Av. Alfredo Benavides 1901, Miraflores",
              city: "Lima",
              location: { lat: -12.1211, lng: -77.0297 },
              url: FIXTURE_MAPS_URL,
            },
          ]),
          { status: 200 },
        ),
    );
    let now = new Date("2026-07-16T10:00:00.000Z");
    const coordinator = new GenerationCoordinator(
      repository,
      new ApifyGoogleMapsProvider("private-token", paidFetch as typeof fetch),
      () => now,
    );
    const submission = await coordinator.submit(FIXTURE_MAPS_URL);
    if (submission.kind !== "generation")
      throw new Error("Expected generation");
    repository.interruptNextPublication();

    expect(await coordinator.advance(submission.id)).toEqual({
      kind: "generating",
      id: submission.id,
    });
    now = new Date("2026-07-16T10:02:00.000Z");
    await expect(coordinator.advance(submission.id)).resolves.toMatchObject({
      kind: "ready",
    });
    expect(paidFetch).toHaveBeenCalledOnce();
  });

  it("reuses the paid checkpoint after media failure and publishes no hotlinks", async () => {
    const repository = new MemoryGenerationRepository();
    const provider = new FixtureRestaurantProvider();
    const base = await provider.load(FIXTURE_MAPS_URL);
    const load = vi.spyOn(provider, "load").mockResolvedValue({
      ...base,
      photos: [
        {
          url: "https://lh3.googleusercontent.com/temporary",
          alt: "Foto del restaurante",
          attribution: "Google Maps contributor",
        },
      ],
    });
    const retain = vi
      .fn()
      .mockRejectedValueOnce(new Error("blob unavailable"))
      .mockImplementationOnce(async (_id, data) => ({
        ...data,
        photos: [
          {
            ...data.photos[0],
            url: "https://store.public.blob.vercel-storage.com/photo.jpg",
          },
        ],
      }));
    const coordinator = new GenerationCoordinator(
      repository,
      provider,
      undefined,
      { retain },
    );
    const submission = await coordinator.submit(FIXTURE_MAPS_URL);
    if (submission.kind !== "generation") throw new Error("Expected generation");

    await expect(coordinator.advance(submission.id)).rejects.toThrow();
    await expect(coordinator.advance(submission.id)).resolves.toMatchObject({
      kind: "ready",
    });
    const persisted = await repository.findById(submission.id);

    expect(load).toHaveBeenCalledOnce();
    expect(retain).toHaveBeenCalledTimes(2);
    expect(persisted?.providerCheckpoint?.photos[0].url).toContain(
      "googleusercontent.com",
    );
    expect(persisted?.publishedData?.photos[0].url).toContain(
      "blob.vercel-storage.com",
    );
    expect(JSON.stringify(persisted?.publishedData)).not.toContain(
      "googleusercontent.com",
    );
  });

  it("persists only a safe error when a provider fails", async () => {
    const repository = new MemoryGenerationRepository();
    const coordinator = new GenerationCoordinator(repository, {
      load: async () => {
        throw new Error("secret upstream diagnostic");
      },
    });
    const submission = await coordinator.submit(FIXTURE_MAPS_URL);
    if (submission.kind !== "generation")
      throw new Error("Expected generation");

    await expect(coordinator.advance(submission.id)).rejects.toThrow(
      "We couldn't finish your site",
    );
    const persisted = await repository.findById(submission.id);
    expect(persisted?.status).toBe("failed");
    expect(persisted?.safeError).not.toContain("upstream");
  });
});

generationRepositoryContract("memory generation repository", async () => {
  return new MemoryGenerationRepository();
});
