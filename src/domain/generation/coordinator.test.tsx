import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RestaurantSite } from "@/components/restaurant-site";
import type { NormalizedRestaurant } from "@/domain/restaurant";
import { GenerationCoordinator } from "./coordinator";
import {
  FIXTURE_MAPS_URL,
  FixtureRestaurantProvider,
} from "./fixture-provider";
import type { Generation, GenerationRepository } from "./types";

class MemoryGenerationRepository implements GenerationRepository {
  private readonly records = new Map<string, Generation>();

  async createOrGet(sourceUrl: string, normalizedSource: string) {
    const existing = [...this.records.values()].find(
      (record) => record.normalizedSource === normalizedSource,
    );
    if (existing) return structuredClone(existing);

    const now = new Date("2026-07-16T10:00:00.000Z");
    const generation: Generation = {
      id: crypto.randomUUID(),
      sourceUrl,
      normalizedSource,
      status: "pending",
      providerCheckpoint: null,
      publishedData: null,
      slug: null,
      safeError: null,
      leaseToken: null,
      leaseAcquiredAt: null,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(generation.id, generation);
    return structuredClone(generation);
  }

  async findById(id: string) {
    const record = this.records.get(id);
    return record ? structuredClone(record) : null;
  }

  async findReadyBySlug(slug: string) {
    const record = [...this.records.values()].find(
      (candidate) => candidate.status === "ready" && candidate.slug === slug,
    );
    return record ? structuredClone(record) : null;
  }

  async claim(id: string, leaseToken: string, staleBefore: Date, now: Date) {
    const record = this.records.get(id);
    if (
      !record ||
      record.status === "ready" ||
      record.attemptCount >= 3 ||
      (record.status === "generating" &&
        record.leaseAcquiredAt &&
        record.leaseAcquiredAt >= staleBefore)
    ) {
      return null;
    }
    Object.assign(record, {
      status: "generating" as const,
      leaseToken,
      leaseAcquiredAt: now,
      safeError: null,
      attemptCount: record.attemptCount + 1,
      updatedAt: now,
    });
    return structuredClone(record);
  }

  async saveCheckpoint(
    id: string,
    leaseToken: string,
    data: NormalizedRestaurant,
    now: Date,
  ) {
    const record = this.records.get(id);
    if (record?.leaseToken !== leaseToken) return false;
    record.providerCheckpoint = structuredClone(data);
    record.updatedAt = now;
    return true;
  }

  async publish(
    id: string,
    leaseToken: string,
    slug: string,
    data: NormalizedRestaurant,
    now: Date,
  ) {
    const record = this.records.get(id);
    if (record?.leaseToken !== leaseToken) return null;
    Object.assign(record, {
      status: "ready" as const,
      publishedData: structuredClone(data),
      slug,
      leaseToken: null,
      leaseAcquiredAt: null,
      updatedAt: now,
    });
    return structuredClone(record);
  }

  async fail(id: string, leaseToken: string, safeError: string, now: Date) {
    const record = this.records.get(id);
    if (record?.leaseToken !== leaseToken) return;
    Object.assign(record, {
      status: "failed" as const,
      safeError,
      leaseToken: null,
      leaseAcquiredAt: null,
      updatedAt: now,
    });
  }
}

describe("fixture generation golden path", () => {
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

    expect(result).toEqual({ kind: "ready", slug: "las-palmeras" });
    expect(persisted).toMatchObject({
      status: "ready",
      slug: "las-palmeras",
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

    expect(duplicate).toEqual({ kind: "ready", slug: "las-palmeras" });
    expect(load).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
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
      "No pudimos generar",
    );
    const persisted = await repository.findById(submission.id);
    expect(persisted?.status).toBe("failed");
    expect(persisted?.safeError).not.toContain("upstream");
  });
});
