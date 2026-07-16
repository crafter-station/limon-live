import "server-only";
import { lt, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core/session";
import { getDatabase } from "./client";
import * as schema from "./schema";

type RateLimitDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

const { submissionRateLimits } = schema;

export class DrizzleRateLimitRepository {
  constructor(private readonly database: RateLimitDatabase = getDatabase()) {}

  async consume(
    requesterKey: string,
    windowStart: Date,
    limit: number,
    now: Date,
  ): Promise<boolean> {
    const [record] = await this.database
      .insert(submissionRateLimits)
      .values({ requesterKey, windowStart, updatedAt: now })
      .onConflictDoUpdate({
        target: [
          submissionRateLimits.requesterKey,
          submissionRateLimits.windowStart,
        ],
        set: {
          requestCount: sql`${submissionRateLimits.requestCount} + 1`,
          updatedAt: now,
        },
        setWhere: lt(submissionRateLimits.requestCount, limit),
      })
      .returning({ requestCount: submissionRateLimits.requestCount });

    return Boolean(record);
  }
}
