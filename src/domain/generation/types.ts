import type { NormalizedRestaurant } from "@/domain/restaurant";

export type GenerationStatus = "pending" | "generating" | "ready" | "failed";

export type Generation = {
  id: string;
  sourceUrl: string;
  normalizedSource: string;
  status: GenerationStatus;
  providerCheckpoint: NormalizedRestaurant | null;
  publishedData: NormalizedRestaurant | null;
  slug: string | null;
  safeError: string | null;
  leaseToken: string | null;
  leaseAcquiredAt: Date | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export interface GenerationRepository {
  createOrGet(sourceUrl: string, normalizedSource: string): Promise<Generation>;
  findById(id: string): Promise<Generation | null>;
  findReadyBySlug(slug: string): Promise<Generation | null>;
  claim(
    id: string,
    leaseToken: string,
    staleBefore: Date,
    now: Date,
  ): Promise<Generation | null>;
  saveCheckpoint(
    id: string,
    leaseToken: string,
    data: NormalizedRestaurant,
    now: Date,
  ): Promise<boolean>;
  publish(
    id: string,
    leaseToken: string,
    slug: string,
    data: NormalizedRestaurant,
    now: Date,
  ): Promise<Generation | null>;
  fail(
    id: string,
    leaseToken: string,
    safeError: string,
    now: Date,
  ): Promise<void>;
}

export interface RestaurantProvider {
  load(normalizedSource: string): Promise<NormalizedRestaurant>;
}
