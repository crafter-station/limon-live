import "server-only";
import { GenerationCoordinator } from "@/domain/generation/coordinator";
import {
  ApifyGoogleMapsProvider,
  GoogleMapsPreviewProvider,
  LiveRestaurantProvider,
} from "@/domain/generation/live-provider";
import { DrizzleGenerationRepository } from "@/server/db/generation-repository";
import { DrizzleRateLimitRepository } from "@/server/db/rate-limit-repository";
import { getServerEnv } from "@/server/env";
import { deriveRequesterKey, utcHour } from "@/server/submission-security";
import { PlacePhotoRetainer } from "@/server/place-photo-retainer";

export const SUBMISSIONS_PER_HOUR = 5;

export function createGenerationCoordinator() {
  const env = getServerEnv();
  return new GenerationCoordinator(
    new DrizzleGenerationRepository(),
    new LiveRestaurantProvider(
      new GoogleMapsPreviewProvider(),
      new ApifyGoogleMapsProvider(env.APIFY_PERSONAL_API_TOKEN),
    ),
    undefined,
    new PlacePhotoRetainer(env.BLOB_READ_WRITE_TOKEN),
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
