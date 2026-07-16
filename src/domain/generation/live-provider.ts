import {
  normalizedRestaurantSchema,
  type NormalizedRestaurant,
} from "@/domain/restaurant";
import type { RestaurantProvider } from "./types";

const FOOD_CATEGORIES =
  /restaurant|restaurante|café|cafe|coffee|bakery|panader|pasteler|pizzer|bar|bistro|food|comida|helader|ice cream/i;

type ProviderRecord = Record<string, unknown>;

export class UnusableRestaurantError extends Error {
  constructor() {
    super("Restaurant data could not be verified.");
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function factualDescription(name: string, category: string, city: string) {
  return `${name} es un ${category.toLocaleLowerCase("es")} ubicado en ${city}.`;
}

export function normalizeRestaurant(
  value: ProviderRecord,
  source: NormalizedRestaurant["source"],
  mapsUrl: string,
  importedAt = new Date().toISOString(),
): NormalizedRestaurant {
  const name = text(value.title ?? value.name);
  const category = text(value.categoryName ?? value.category);
  const address = text(value.address ?? value.streetAddress);
  const city = text(value.city ?? value.addressLocality);
  const location = value.location as ProviderRecord | undefined;
  const lat = Number(location?.lat ?? value.latitude);
  const lng = Number(location?.lng ?? value.longitude);
  const canonicalUrl = text(value.url ?? value.mapsUrl) ?? mapsUrl;

  if (
    !name ||
    !category ||
    !address ||
    !city ||
    !FOOD_CATEGORIES.test(category) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    throw new UnusableRestaurantError();
  }

  const description =
    text(value.description) ?? factualDescription(name, category, city);
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
    phone: text(value.phoneUnformatted ?? value.phone),
    website: text(value.website),
    location: { lat, lng },
    hours: rawHours.flatMap((entry) => {
      const item = entry as ProviderRecord;
      const day = text(item.day);
      const hours = text(item.hours);
      return day && hours ? [{ day, hours }] : [];
    }),
    rating:
      typeof value.totalScore === "number"
        ? value.totalScore
        : typeof value.ratingValue === "number"
          ? value.ratingValue
          : null,
    reviewCount:
      typeof value.reviewsCount === "number"
        ? value.reviewsCount
        : typeof value.reviewCount === "number"
          ? value.reviewCount
          : null,
    reviews: rawReviews.flatMap((entry) => {
      const item = entry as ProviderRecord;
      const reviewText = text(item.text ?? item.reviewBody);
      return reviewText
        ? [
            {
              author: text(item.name ?? item.author),
              text: reviewText,
              rating: typeof item.stars === "number" ? item.stars : null,
            },
          ]
        : [];
    }),
    attribution: "Google Maps",
    mapsUrl: canonicalUrl,
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
  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]) as ProviderRecord;
      const geo = data.geo as ProviderRecord | undefined;
      const address = data.address as ProviderRecord | undefined;
      if (text(data.name) && geo && address) {
        return {
          ...data,
          category: data.servesCuisine ?? data["@type"],
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
      // Continue to another JSON-LD block.
    }
  }
  throw new UnusableRestaurantError();
}

export class GoogleMapsPreviewProvider implements RestaurantProvider {
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async load(normalizedSource: string) {
    const response = await this.fetcher(normalizedSource, {
      signal: AbortSignal.timeout(8_000),
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
});

export class ApifyGoogleMapsProvider implements RestaurantProvider {
  constructor(
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  async load(normalizedSource: string) {
    const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?timeout=60&maxItems=1&maxTotalChargeUsd=0.02`;
    const response = await this.fetcher(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(70_000),
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(APIFY_INPUT(normalizedSource)),
    });
    if (!response.ok) throw new UnusableRestaurantError();
    const items = await response.json();
    if (!Array.isArray(items) || items.length !== 1)
      throw new UnusableRestaurantError();
    return normalizeRestaurant(
      items[0] as ProviderRecord,
      "apify-google-maps",
      normalizedSource,
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
      try {
        return await this.enrichment.load(normalizedSource);
      } catch {}
    }
    if (baseline) return baseline;
    throw new UnusableRestaurantError();
  }
}
