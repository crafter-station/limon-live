import type { Menu } from "@/domain/menu";
import type { NormalizedRestaurant } from "@/domain/restaurant";

export const MAX_GENERATION_ATTEMPTS = 3;
export const GENERATION_FAILURE_MESSAGE =
  "We couldn't finish your site right now. Please try again.";

export type GenerationStatus = "pending" | "generating" | "ready" | "failed";
export type MenuStatus = "pending" | "published" | "none" | "failed";

export type Generation = {
  id: string;
  sourceUrl: string;
  normalizedSource: string;
  status: GenerationStatus;
  providerCheckpoint: NormalizedRestaurant | null;
  publishedData: NormalizedRestaurant | null;
  menuStatus: MenuStatus;
  menuData: Menu | null;
  menuSafeError: string | null;
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
  saveMenuOutcome(
    id: string,
    status: Exclude<MenuStatus, "pending">,
    menu: Menu | null,
    safeError: string | null,
    now: Date,
  ): Promise<boolean>;
}

export interface RestaurantProvider {
  load(normalizedSource: string): Promise<NormalizedRestaurant>;
}

export interface RestaurantMediaRetainer {
  retain(
    generationId: string,
    data: NormalizedRestaurant,
  ): Promise<NormalizedRestaurant>;
}

export interface RestaurantMenuExtractor {
  extract(photos: NormalizedRestaurant["photos"]): Promise<Menu | null>;
}
