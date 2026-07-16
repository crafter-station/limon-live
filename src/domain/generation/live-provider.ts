import {
  normalizedRestaurantSchema,
  type NormalizedRestaurant,
} from "@/domain/restaurant";
import type { RestaurantProvider } from "./types";

const EXACT_FOOD_CATEGORIES = new Set([
  "restaurant",
  "restaurante",
  "cafe",
  "cafeteria",
  "cafe or coffee shop",
  "coffee shop",
  "bakery",
  "panaderia",
  "pasteleria",
  "pizzeria",
  "bistro",
  "food court",
  "heladeria",
  "ice cream shop",
  "bar",
  "pub",
  "tea house",
  "dessert shop",
]);

const TECHNICAL_CATEGORY_NAMES: Record<string, string> = {
  Restaurant: "Restaurante",
  CafeOrCoffeeShop: "Café",
  Bakery: "Panadería",
  BarOrPub: "Pub",
};

type ProviderRecord = Record<string, unknown>;

export class UnusableRestaurantError extends Error {
  constructor() {
    super("Restaurant data could not be verified.");
  }
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function coordinate(value: unknown): number | null {
  if (typeof value !== "number" && !(typeof value === "string" && value.trim()))
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedCategory(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFoodCategory(value: string) {
  const category = normalizedCategory(value);
  return (
    EXACT_FOOD_CATEGORIES.has(category) ||
    /^(?:restaurante|cafeteria|panaderia|pasteleria|pizzeria)\b/.test(
      category,
    ) ||
    /\b(?:restaurant|cafe|bakery|bistro)$/.test(category)
  );
}

function factualDescription(name: string, category: string, city: string) {
  return `${name}: ${category.toLocaleLowerCase("es")} en ${city}.`;
}

function sameNormalizedText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" }) === 0;
}

function isSameVenue(
  baseline: NormalizedRestaurant,
  enriched: NormalizedRestaurant,
) {
  if (!sameNormalizedText(baseline.name, enriched.name)) return false;

  const addressAgrees =
    sameNormalizedText(baseline.address, enriched.address) &&
    sameNormalizedText(baseline.city, enriched.city);
  const coordinatesAgree =
    Math.abs(baseline.location.lat - enriched.location.lat) <= 0.001 &&
    Math.abs(baseline.location.lng - enriched.location.lng) <= 0.001;
  return addressAgrees && coordinatesAgree;
}

export function normalizeRestaurant(
  value: ProviderRecord,
  source: NormalizedRestaurant["source"],
  mapsUrl: string,
  importedAt = new Date().toISOString(),
): NormalizedRestaurant {
  const name = nonEmptyText(value.title ?? value.name);
  const category = nonEmptyText(value.categoryName ?? value.category);
  const address = nonEmptyText(value.streetAddress ?? value.address);
  const city = nonEmptyText(value.city ?? value.addressLocality);
  const location = value.location as ProviderRecord | undefined;
  const lat = coordinate(location?.lat ?? value.latitude);
  const lng = coordinate(location?.lng ?? value.longitude);

  if (
    !name ||
    !category ||
    !address ||
    !city ||
    !isFoodCategory(category) ||
    lat === null ||
    lng === null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new UnusableRestaurantError();
  }

  const description =
    nonEmptyText(value.description) ?? factualDescription(name, category, city);
  const rawHours = Array.isArray(value.openingHours) ? value.openingHours : [];
  const rawReviews = Array.isArray(value.reviews)
    ? value.reviews.slice(0, 3)
    : [];
  return normalizedRestaurantSchema.parse({
    name,
    category,
    description,
    address,
    city,
    phone: nonEmptyText(value.phoneUnformatted ?? value.phone),
    website: nonEmptyText(value.website),
    location: { lat, lng },
    hours: rawHours.flatMap((entry) => {
      const item = entry as ProviderRecord;
      const day = nonEmptyText(item.day);
      const hours = nonEmptyText(item.hours);
      return day && hours ? [{ day, hours }] : [];
    }),
    rating: finiteNumber(value.totalScore) ?? finiteNumber(value.ratingValue),
    reviewCount:
      finiteNumber(value.reviewsCount) ?? finiteNumber(value.reviewCount),
    reviews: rawReviews.flatMap((entry) => {
      const item = entry as ProviderRecord;
      const reviewText = nonEmptyText(item.text ?? item.reviewBody);
      return reviewText
        ? [
            {
              author: nonEmptyText(item.name ?? item.author),
              text: reviewText,
              rating: typeof item.stars === "number" ? item.stars : null,
            },
          ]
        : [];
    }),
    attribution: "Google Maps",
    mapsUrl,
    source,
    diagnostics: {
      provider: source,
      warnings:
        description === value.description ? [] : ["description-generated"],
    },
    importedAt,
  });
}

/** Replaceable parser for Google's undocumented public preview representation. */
export function parseGoogleMapsPreview(html: string): ProviderRecord {
  const scripts = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  if (scripts.length !== 1) throw new UnusableRestaurantError();

  try {
    const data = JSON.parse(scripts[0][1]) as ProviderRecord;
    const geo = data.geo as ProviderRecord | undefined;
    const address = data.address as ProviderRecord | undefined;
    if (nonEmptyText(data.name) && geo && address) {
      return {
        ...data,
        category:
          TECHNICAL_CATEGORY_NAMES[String(data["@type"])] ?? data["@type"],
        streetAddress: address.streetAddress,
        addressLocality: address.addressLocality,
        latitude: geo.latitude,
        longitude: geo.longitude,
        ratingValue: Number(
          (data.aggregateRating as ProviderRecord | undefined)?.ratingValue,
        ),
        reviewCount: Number(
          (data.aggregateRating as ProviderRecord | undefined)?.reviewCount,
        ),
      };
    }
  } catch {
    throw new UnusableRestaurantError();
  }
  throw new UnusableRestaurantError();
}

export const PREVIEW_TIMEOUT_MS = 8_000;

export class GoogleMapsPreviewProvider implements RestaurantProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async load(normalizedSource: string) {
    const response = await this.fetcher(normalizedSource, {
      signal: AbortSignal.timeout(PREVIEW_TIMEOUT_MS),
      headers: { "accept-language": "es" },
    });
    if (!response.ok) throw new UnusableRestaurantError();
    return normalizeRestaurant(
      parseGoogleMapsPreview(await response.text()),
      "google-maps-preview",
      normalizedSource,
    );
  }
}

export const APIFY_ACTOR = "compass~crawler-google-places";
export const APIFY_ACTOR_TIMEOUT_SECONDS = 40;
export const APIFY_CLIENT_TIMEOUT_MS = 45_000;
export const APIFY_INPUT = (url: string) => ({
  startUrls: [{ url }],
  language: "es",
  maxCrawledPlacesPerSearch: 1,
  maxReviews: 3,
  maxImages: 3,
  scrapeContacts: false,
  scrapeDirectories: false,
  scrapeImageAuthors: false,
  scrapePlaceDetailPage: true,
  enableCompetitorAnalysis: false,
  maxCompetitorsToAnalyze: 0,
  scrapeReviewsPersonalData: false,
});

export class ApifyGoogleMapsProvider implements RestaurantProvider {
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async load(normalizedSource: string) {
    const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?timeout=${APIFY_ACTOR_TIMEOUT_SECONDS}&maxItems=1&maxTotalChargeUsd=0.5`;
    const response = await this.fetcher(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(APIFY_CLIENT_TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(APIFY_INPUT(normalizedSource)),
    });
    if (!response.ok) throw new UnusableRestaurantError();
    let items: unknown;
    try {
      items = await response.json();
    } catch {
      throw new UnusableRestaurantError();
    }
    if (!Array.isArray(items) || items.length !== 1)
      throw new UnusableRestaurantError();
    const item = items[0] as ProviderRecord;
    if (nonEmptyText(item.url) !== normalizedSource)
      throw new UnusableRestaurantError();
    return normalizeRestaurant(item, "apify-google-maps", normalizedSource);
  }
}

export class LiveRestaurantProvider implements RestaurantProvider {
  constructor(
    private readonly baseline: RestaurantProvider,
    private readonly enrichment?: RestaurantProvider,
  ) {}
  async load(normalizedSource: string) {
    let baseline: NormalizedRestaurant | null = null;
    try {
      baseline = await this.baseline.load(normalizedSource);
    } catch {}
    if (this.enrichment) {
      try {
        const enriched = await this.enrichment.load(normalizedSource);
        if (!baseline || isSameVenue(baseline, enriched)) {
          return enriched;
        }
      } catch {}
    }
    if (baseline) return baseline;
    throw new UnusableRestaurantError();
  }
}
