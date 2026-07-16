import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { NormalizedRestaurant } from "@/domain/restaurant";

export const generationStatus = pgEnum("generation_status", [
  "pending",
  "generating",
  "ready",
  "failed",
]);

export const restaurantGenerations = pgTable(
  "restaurant_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceUrl: text("source_url").notNull(),
    normalizedSource: text("normalized_source").notNull().unique(),
    status: generationStatus("status").notNull().default("pending"),
    providerCheckpoint: jsonb(
      "provider_checkpoint",
    ).$type<NormalizedRestaurant | null>(),
    publishedData: jsonb("published_data").$type<NormalizedRestaurant | null>(),
    slug: text("slug").unique(),
    safeError: varchar("safe_error", { length: 240 }),
    leaseToken: uuid("lease_token"),
    leaseAcquiredAt: timestamp("lease_acquired_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "ready_generation_has_publication",
      sql`${table.status} <> 'ready' OR (${table.slug} IS NOT NULL AND ${table.publishedData} IS NOT NULL)`,
    ),
    check(
      "generation_attempt_count_nonnegative",
      sql`${table.attemptCount} >= 0`,
    ),
  ],
);
