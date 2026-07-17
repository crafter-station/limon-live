import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { Menu } from "@/domain/menu";
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
    menuStatus: varchar("menu_status", { length: 16 })
      .$type<"pending" | "published" | "none" | "failed">()
      .notNull()
      .default("pending"),
    menuData: jsonb("menu_data").$type<Menu | null>(),
    menuSafeError: varchar("menu_safe_error", { length: 240 }),
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

export const submissionRateLimits = pgTable(
  "submission_rate_limits",
  {
    requesterKey: varchar("requester_key", { length: 64 }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    requestCount: integer("request_count").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.requesterKey, table.windowStart] }),
    check("rate_limit_count_positive", sql`${table.requestCount} > 0`),
  ],
);
