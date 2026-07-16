import { describe, expect, it } from "vitest";
import {
  GENERATION_FAILURE_MESSAGE,
  type GenerationRepository,
  MAX_GENERATION_ATTEMPTS,
} from "@/domain/generation/types";
import {
  FIXTURE_MAPS_URL,
  FIXTURE_NORMALIZED_SOURCE,
  FixtureRestaurantProvider,
} from "@/domain/generation/fixture-provider";

const leaseTokens = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
  "00000000-0000-4000-8000-000000000004",
];

export function generationRepositoryContract(
  name: string,
  createRepository: () => Promise<GenerationRepository>,
) {
  describe(name, () => {
    it("atomically reuses concurrent duplicate submissions", async () => {
      const repository = await createRepository();
      const [first, duplicate] = await Promise.all([
        repository.createOrGet(FIXTURE_MAPS_URL, FIXTURE_NORMALIZED_SOURCE),
        repository.createOrGet(
          `${FIXTURE_MAPS_URL}?duplicate=true`,
          FIXTURE_NORMALIZED_SOURCE,
        ),
      ]);

      expect(duplicate.id).toBe(first.id);
      expect(first.status).toBe("pending");
    });

    it("fences active and stale leases", async () => {
      const repository = await createRepository();
      const generation = await repository.createOrGet(
        FIXTURE_MAPS_URL,
        FIXTURE_NORMALIZED_SOURCE,
      );
      const first = await repository.claim(
        generation.id,
        leaseTokens[0],
        new Date("2026-07-16T09:59:00.000Z"),
        new Date("2026-07-16T10:00:00.000Z"),
      );

      expect(first).toMatchObject({ attemptCount: 1, status: "generating" });
      expect(
        await repository.claim(
          generation.id,
          leaseTokens[1],
          new Date("2026-07-16T09:59:30.000Z"),
          new Date("2026-07-16T10:00:30.000Z"),
        ),
      ).toBeNull();
      expect(
        await repository.claim(
          generation.id,
          leaseTokens[1],
          new Date("2026-07-16T10:01:00.000Z"),
          new Date("2026-07-16T10:02:00.000Z"),
        ),
      ).toMatchObject({ attemptCount: 2, leaseToken: leaseTokens[1] });
    });

    it("rejects checkpoint and publication writes from a lost lease", async () => {
      const repository = await createRepository();
      const generation = await repository.createOrGet(
        FIXTURE_MAPS_URL,
        FIXTURE_NORMALIZED_SOURCE,
      );
      const data = await new FixtureRestaurantProvider().load(
        FIXTURE_NORMALIZED_SOURCE,
      );
      const now = new Date("2026-07-16T10:00:00.000Z");
      await repository.claim(
        generation.id,
        leaseTokens[0],
        new Date("2026-07-16T09:59:00.000Z"),
        now,
      );

      expect(
        await repository.saveCheckpoint(
          generation.id,
          leaseTokens[1],
          data,
          now,
        ),
      ).toBe(false);
      expect(
        await repository.publish(
          generation.id,
          leaseTokens[1],
          "las-palmeras",
          data,
          now,
        ),
      ).toBeNull();
      expect(await repository.findById(generation.id)).toMatchObject({
        status: "generating",
        providerCheckpoint: null,
        publishedData: null,
      });
    });

    it("finalizes an exhausted stale lease instead of stranding it", async () => {
      const repository = await createRepository();
      const generation = await repository.createOrGet(
        FIXTURE_MAPS_URL,
        FIXTURE_NORMALIZED_SOURCE,
      );

      for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        const minute = attempt * 2;
        await expect(
          repository.claim(
            generation.id,
            leaseTokens[attempt],
            new Date(Date.UTC(2026, 6, 16, 9, 59 + minute)),
            new Date(Date.UTC(2026, 6, 16, 10, minute)),
          ),
        ).resolves.toMatchObject({ attemptCount: attempt + 1 });
      }

      await expect(
        repository.claim(
          generation.id,
          leaseTokens[3],
          new Date("2026-07-16T10:05:00.000Z"),
          new Date("2026-07-16T10:06:00.000Z"),
        ),
      ).resolves.toBeNull();
      expect(await repository.findById(generation.id)).toMatchObject({
        status: "failed",
        attemptCount: MAX_GENERATION_ATTEMPTS,
        safeError: GENERATION_FAILURE_MESSAGE,
        leaseToken: null,
        leaseAcquiredAt: null,
      });
    });
  });
}
