import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DrizzleRateLimitRepository } from "./rate-limit-repository";
import * as schema from "./schema";

const client = new PGlite();
const database = drizzle(client, { schema });

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  await database.delete(schema.submissionRateLimits);
});

afterAll(async () => {
  await client.close();
});

describe("Drizzle rate-limit repository", () => {
  it("atomically permits only the configured number of concurrent increments", async () => {
    const repository = new DrizzleRateLimitRepository(database);
    const bucket = new Date("2026-07-16T10:00:00.000Z");
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        repository.consume("a".repeat(64), bucket, 5, bucket),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(5);
    await expect(
      database.select().from(schema.submissionRateLimits),
    ).resolves.toEqual([
      expect.objectContaining({
        requesterKey: "a".repeat(64),
        requestCount: 5,
      }),
    ]);
  });

  it("uses independent requester and hourly buckets", async () => {
    const repository = new DrizzleRateLimitRepository(database);
    const firstHour = new Date("2026-07-16T10:00:00.000Z");
    const nextHour = new Date("2026-07-16T11:00:00.000Z");

    await expect(
      repository.consume("a".repeat(64), firstHour, 1, firstHour),
    ).resolves.toBe(true);
    await expect(
      repository.consume("a".repeat(64), firstHour, 1, firstHour),
    ).resolves.toBe(false);
    await expect(
      repository.consume("a".repeat(64), nextHour, 1, nextHour),
    ).resolves.toBe(true);
    await expect(
      repository.consume("b".repeat(64), firstHour, 1, firstHour),
    ).resolves.toBe(true);
  });
});
