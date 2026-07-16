import "server-only";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { NormalizedRestaurant } from "@/domain/restaurant";
import type {
  Generation,
  GenerationRepository,
} from "@/domain/generation/types";
import { getDatabase } from "./client";
import { restaurantGenerations } from "./schema";

const MAX_ATTEMPTS = 3;

export class DrizzleGenerationRepository implements GenerationRepository {
  private readonly database = getDatabase();

  async createOrGet(
    sourceUrl: string,
    normalizedSource: string,
  ): Promise<Generation> {
    const [created] = await this.database
      .insert(restaurantGenerations)
      .values({ sourceUrl, normalizedSource })
      .onConflictDoNothing({ target: restaurantGenerations.normalizedSource })
      .returning();

    if (created) return created;

    const [existing] = await this.database
      .select()
      .from(restaurantGenerations)
      .where(eq(restaurantGenerations.normalizedSource, normalizedSource))
      .limit(1);

    if (!existing) throw new Error("Generation could not be persisted.");
    return existing;
  }

  async findById(id: string): Promise<Generation | null> {
    const [generation] = await this.database
      .select()
      .from(restaurantGenerations)
      .where(eq(restaurantGenerations.id, id))
      .limit(1);
    return generation ?? null;
  }

  async findReadyBySlug(slug: string): Promise<Generation | null> {
    const [generation] = await this.database
      .select()
      .from(restaurantGenerations)
      .where(
        and(
          eq(restaurantGenerations.slug, slug),
          eq(restaurantGenerations.status, "ready"),
        ),
      )
      .limit(1);
    return generation ?? null;
  }

  async claim(
    id: string,
    leaseToken: string,
    staleBefore: Date,
    now: Date,
  ): Promise<Generation | null> {
    const [claimed] = await this.database
      .update(restaurantGenerations)
      .set({
        status: "generating",
        leaseToken,
        leaseAcquiredAt: now,
        safeError: null,
        attemptCount: sql`${restaurantGenerations.attemptCount} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantGenerations.id, id),
          lt(restaurantGenerations.attemptCount, MAX_ATTEMPTS),
          or(
            eq(restaurantGenerations.status, "pending"),
            eq(restaurantGenerations.status, "failed"),
            and(
              eq(restaurantGenerations.status, "generating"),
              or(
                isNull(restaurantGenerations.leaseAcquiredAt),
                lt(restaurantGenerations.leaseAcquiredAt, staleBefore),
              ),
            ),
          ),
        ),
      )
      .returning();
    return claimed ?? null;
  }

  async saveCheckpoint(
    id: string,
    leaseToken: string,
    data: NormalizedRestaurant,
    now: Date,
  ): Promise<boolean> {
    const [updated] = await this.database
      .update(restaurantGenerations)
      .set({ providerCheckpoint: data, updatedAt: now })
      .where(
        and(
          eq(restaurantGenerations.id, id),
          eq(restaurantGenerations.leaseToken, leaseToken),
          eq(restaurantGenerations.status, "generating"),
        ),
      )
      .returning({ id: restaurantGenerations.id });
    return Boolean(updated);
  }

  async publish(
    id: string,
    leaseToken: string,
    slug: string,
    data: NormalizedRestaurant,
    now: Date,
  ): Promise<Generation | null> {
    const [published] = await this.database
      .update(restaurantGenerations)
      .set({
        status: "ready",
        publishedData: data,
        slug,
        safeError: null,
        leaseToken: null,
        leaseAcquiredAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantGenerations.id, id),
          eq(restaurantGenerations.leaseToken, leaseToken),
          eq(restaurantGenerations.status, "generating"),
        ),
      )
      .returning();
    return published ?? null;
  }

  async fail(
    id: string,
    leaseToken: string,
    safeError: string,
    now: Date,
  ): Promise<void> {
    await this.database
      .update(restaurantGenerations)
      .set({
        status: "failed",
        safeError,
        leaseToken: null,
        leaseAcquiredAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(restaurantGenerations.id, id),
          eq(restaurantGenerations.leaseToken, leaseToken),
        ),
      );
  }
}
