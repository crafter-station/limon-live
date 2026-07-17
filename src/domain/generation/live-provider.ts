import {
  type NormalizedRestaurant,
  normalizedRestaurantSchema,
} from "@/domain/restaurant";
import {
  hasSameGoogleMapsPlaceIdentity,
  resolveGoogleMapsUrl,
} from "./maps-url";
import { foldText } from "./text";
import type { RestaurantProvider } from "./types";

const FOOD_CATEGORY_NAMES: Record<string, string> = {
  restaurant: "restaurante",
  restaurante: "restaurante",
  "peruvian restaurant": "restaurante",
  "restaurante peruano": "restaurante",
  "cafe or coffee shop": "café",
  "coffee shop": "cafetería",
  cafe: "café",
  cafeteria: "cafetería",
  bakery: "panadería",
  panaderia: "panadería",
  pasteleria: "pastelería",
  pizzeria: "pizzería",
  bistro: "bistró",
  "food court": "patio de comidas",
  heladeria: "heladería",
  "ice cream shop": "heladería",
  bar: "bar",
  pub: "pub",
  "tea house": "salón de té",
  "dessert shop": "tienda de postres",
  "sandwich shop": "sandwichería",
  "food truck": "puesto de comida",
  deli: "delicatessen",
};

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

function isoDate(value: unknown): string | null {
  const text = nonEmptyText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function coordinate(value: unknown): number | null {
  if (typeof value !== "number" && !(typeof value === "string" && value.trim()))
    return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedCategory(value: string) {
  return foldText(value.replace(/([a-z])([A-Z])/g, "$1 $2"))
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFoodCategory(value: string) {
  const category = normalizedCategory(value);
  return FOOD_CATEGORY_NAMES[category] !== undefined;
}

function factualDescription(name: string, category: string, city: string) {
  const normalized = normalizedCategory(category);
  const spanishCategory =
    FOOD_CATEGORY_NAMES[normalized] ??
    (normalized.endsWith(" restaurant") ? "restaurante" : null) ??
    category.toLocaleLowerCase("es");
  return `${name}: ${spanishCategory} en ${city}.`;
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
    !baseline.location ||
    !enriched.location ||
    (Math.abs(baseline.location.lat - enriched.location.lat) <= 0.001 &&
      Math.abs(baseline.location.lng - enriched.location.lng) <= 0.001);
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
  const rawLat = location?.lat ?? value.latitude;
  const rawLng = location?.lng ?? value.longitude;
  const hasLat = rawLat !== undefined && rawLat !== null;
  const hasLng = rawLng !== undefined && rawLng !== null;
  const lat = coordinate(rawLat);
  const lng = coordinate(rawLng);
  const hasCompleteLocation =
    hasLat &&
    hasLng &&
    lat !== null &&
    lng !== null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  if (
    !name ||
    !category ||
    !address ||
    !city ||
    !isFoodCategory(category) ||
    (hasLat || hasLng) !== hasCompleteLocation
  ) {
    throw new UnusableRestaurantError();
  }

  const description =
    nonEmptyText(value.description) ?? factualDescription(name, category, city);
  const rawHours = Array.isArray(value.openingHours) ? value.openingHours : [];
  const rawReviews = Array.isArray(value.reviews)
    ? value.reviews.slice(0, 3)
    : [];
  const detailedPhotos = Array.isArray(value.images) ? value.images : [];
  const rawPhotos = Array.isArray(value.imageUrls)
    ? value.imageUrls.map((url) => {
        const details = detailedPhotos.find((entry) => {
          if (!entry || typeof entry !== "object") return false;
          const item = entry as ProviderRecord;
          return item.imageUrl === url || item.url === url;
        });
        return details && typeof details === "object"
          ? { ...(details as ProviderRecord), imageUrl: url }
          : url;
      })
    : detailedPhotos;
  return normalizedRestaurantSchema.parse({
    name,
    category,
    description,
    address,
    city,
    phone: nonEmptyText(value.phoneUnformatted ?? value.phone),
    website: nonEmptyText(value.website),
    location: hasCompleteLocation ? { lat, lng } : null,
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
              publishedAt: isoDate(item.publishedAtDate ?? item.publishedAt),
            },
          ]
        : [];
    }),
    photos: rawPhotos.slice(0, 3).flatMap((entry, index) => {
      const item =
        typeof entry === "string"
          ? { imageUrl: entry }
          : (entry as ProviderRecord);
      const url = nonEmptyText(item.imageUrl ?? item.url);
      if (!url) return [];
      try {
        new URL(url);
      } catch {
        return [];
      }
      return [
        {
          url,
          alt: `Foto ${index + 1} de ${name}`,
          attribution: nonEmptyText(item.attribution ?? item.authorName),
        },
      ];
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
  reviewsOrigin: "google",
  maxImages: 3,
  scrapeContacts: false,
  scrapeDirectories: false,
  scrapeImageAuthors: true,
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
    const returnedUrl = nonEmptyText(item.url);
    let normalizedReturnedUrl: string;
    try {
      normalizedReturnedUrl = returnedUrl
        ? await resolveGoogleMapsUrl(returnedUrl, async () => {
            throw new UnusableRestaurantError();
          })
        : "";
    } catch {
      throw new UnusableRestaurantError();
    }
    if (
      !hasSameGoogleMapsPlaceIdentity(normalizedReturnedUrl, normalizedSource)
    )
      throw new UnusableRestaurantError();
    return normalizeRestaurant(
      item,
      "apify-google-maps",
      normalizedReturnedUrl,
    );
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
      let enriched: NormalizedRestaurant;
      try {
        enriched = await this.enrichment.load(normalizedSource);
      } catch {
        if (baseline) return baseline;
        throw new UnusableRestaurantError();
      }
      if (baseline && !isSameVenue(baseline, enriched))
        throw new UnusableRestaurantError();
      return enriched;
    }
    if (baseline) return baseline;
    throw new UnusableRestaurantError();
  }
}
