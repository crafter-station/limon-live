import "server-only";
import { GenerationCoordinator } from "@/domain/generation/coordinator";
import { FixtureRestaurantProvider } from "@/domain/generation/fixture-provider";
import { DrizzleGenerationRepository } from "@/server/db/generation-repository";
import { DrizzleRateLimitRepository } from "@/server/db/rate-limit-repository";
import { getServerEnv } from "@/server/env";
import { deriveRequesterKey, utcHour } from "@/server/submission-security";

export const SUBMISSIONS_PER_HOUR = 5;

export function createGenerationCoordinator() {
  return new GenerationCoordinator(
    new DrizzleGenerationRepository(),
    new FixtureRestaurantProvider(),
  );
}

export async function consumeSubmissionLimit(
  requesterAddress: string,
  now = new Date(),
): Promise<boolean> {
  const requesterKey = deriveRequesterKey(
    requesterAddress,
    getServerEnv().DATABASE_URL,
  );
  return new DrizzleRateLimitRepository().consume(
    requesterKey,
    utcHour(now),
    SUBMISSIONS_PER_HOUR,
    now,
  );
}
