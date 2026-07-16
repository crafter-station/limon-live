import { createHash, randomUUID } from "node:crypto";
import { normalizedRestaurantSchema } from "@/domain/restaurant";
import { resolveGoogleMapsUrl } from "./maps-url";
import {
  GENERATION_FAILURE_MESSAGE,
  type GenerationRepository,
  MAX_GENERATION_ATTEMPTS,
  type RestaurantProvider,
} from "./types";

const LEASE_DURATION_MS = 60_000;

export function restaurantSlug(name: string, normalizedSource: string) {
  const readable = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const venueId = createHash("sha256")
    .update(normalizedSource)
    .digest("hex")
    .slice(0, 10);
  return `${readable || "restaurante"}-${venueId}`;
}

export type SubmissionResult =
  | { kind: "generation"; id: string }
  | { kind: "ready"; slug: string };

export type AdvanceResult =
  | { kind: "generating"; id: string }
  | { kind: "failed"; id: string }
  | { kind: "ready"; slug: string };

export class GenerationFailedError extends Error {}

export class GenerationCoordinator {
  constructor(
    private readonly repository: GenerationRepository,
    private readonly provider: RestaurantProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async submit(sourceUrl: string): Promise<SubmissionResult> {
    const normalizedSource = await resolveGoogleMapsUrl(sourceUrl);
    const generation = await this.repository.createOrGet(
      sourceUrl,
      normalizedSource,
    );

    if (generation.status === "ready" && generation.slug) {
      return { kind: "ready", slug: generation.slug };
    }

    return { kind: "generation", id: generation.id };
  }

  async advance(id: string): Promise<AdvanceResult> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new Error("Generation not found.");
    if (existing.status === "ready" && existing.slug) {
      return { kind: "ready", slug: existing.slug };
    }

    const now = this.now();
    const leaseToken = randomUUID();
    const claimed = await this.repository.claim(
      id,
      leaseToken,
      new Date(now.getTime() - LEASE_DURATION_MS),
      now,
    );

    if (!claimed) {
      const latest = await this.repository.findById(id);
      if (latest?.status === "ready" && latest.slug) {
        return { kind: "ready", slug: latest.slug };
      }
      if (
        latest?.status === "failed" &&
        latest.attemptCount >= MAX_GENERATION_ATTEMPTS
      ) {
        return { kind: "failed", id };
      }
      return { kind: "generating", id };
    }

    try {
      const data = claimed.providerCheckpoint
        ? normalizedRestaurantSchema.parse(claimed.providerCheckpoint)
        : normalizedRestaurantSchema.parse(
            await this.provider.load(claimed.normalizedSource),
          );

      if (!claimed.providerCheckpoint) {
        const checkpointed = await this.repository.saveCheckpoint(
          id,
          leaseToken,
          data,
          this.now(),
        );
        if (!checkpointed) return { kind: "generating", id };
      }

      const published = await this.repository.publish(
        id,
        leaseToken,
        restaurantSlug(data.name, claimed.normalizedSource),
        data,
        this.now(),
      );
      if (!published?.slug) return { kind: "generating", id };

      return { kind: "ready", slug: published.slug };
    } catch {
      await this.repository.fail(
        id,
        leaseToken,
        GENERATION_FAILURE_MESSAGE,
        this.now(),
      );
      throw new GenerationFailedError(GENERATION_FAILURE_MESSAGE);
    }
  }
}
