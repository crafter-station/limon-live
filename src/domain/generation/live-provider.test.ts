import { describe, expect, it, vi } from "vitest";
import {
  APIFY_INPUT,
  ApifyGoogleMapsProvider,
  LiveRestaurantProvider,
  UnusableRestaurantError,
  normalizeRestaurant,
  parseGoogleMapsPreview,
} from "./live-provider";

const mapsUrl = "https://www.google.com/maps/place/Cafe+Limon";
const place = {
  title: "Café Limón",
  categoryName: "Café",
  address: "Calle Lima 10, Miraflores",
  city: "Lima",
  location: { lat: -12.12, lng: -77.03 },
  totalScore: 4.5,
  reviewsCount: 12,
  openingHours: [{ day: "lunes", hours: "08:00-18:00" }],
  reviews: [{ name: "Ana", text: "Buen café", stars: 5 }],
  url: mapsUrl,
};

describe("live restaurant providers", () => {
  it("normalizes realistic output and creates factual fallback copy", () => {
    const restaurant = normalizeRestaurant(
      place,
      "apify-google-maps",
      mapsUrl,
      "2026-07-16T00:00:00.000Z",
    );
    expect(restaurant).toMatchObject({
      name: "Café Limón",
      description: "Café Limón es un café ubicado en Lima.",
      location: { lat: -12.12, lng: -77.03 },
      attribution: "Google Maps",
      diagnostics: { warnings: ["description-generated"] },
    });
    expect(restaurant.reviews).toHaveLength(1);
  });

  it("rejects unrelated and unlocatable results", () => {
    expect(() =>
      normalizeRestaurant(
        { ...place, categoryName: "Dentist" },
        "apify-google-maps",
        mapsUrl,
      ),
    ).toThrow(UnusableRestaurantError);
    expect(() =>
      normalizeRestaurant(
        { ...place, location: undefined },
        "apify-google-maps",
        mapsUrl,
      ),
    ).toThrow(UnusableRestaurantError);
  });

  it("isolates parsing of a realistic public preview", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Restaurant", name: "Casa Sol", servesCuisine: "Restaurante peruano", address: { streetAddress: "Av. Sol 4", addressLocality: "Cusco" }, geo: { latitude: -13.52, longitude: -71.97 } })}</script>`;
    expect(parseGoogleMapsPreview(html)).toMatchObject({
      name: "Casa Sol",
      addressLocality: "Cusco",
    });
    expect(() => parseGoogleMapsPreview("<html></html>")).toThrow(
      UnusableRestaurantError,
    );
  });

  it("bounds paid requests and keeps credentials out of URLs", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify([place]), { status: 200 }),
    );
    await new ApifyGoogleMapsProvider(
      "private-token",
      fetcher as typeof fetch,
    ).load(mapsUrl);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit & { headers: Record<string, string>; body: string },
    ];
    expect(url).toContain("maxItems=1&maxTotalChargeUsd=0.5");
    expect(url).not.toContain("private-token");
    expect(init.headers.authorization).toBe("Bearer private-token");
    expect(JSON.parse(init.body)).toEqual(APIFY_INPUT(mapsUrl));
    expect(APIFY_INPUT(mapsUrl)).toMatchObject({
      language: "es",
      maxCrawledPlacesPerSearch: 1,
      maxReviews: 3,
      maxImages: 3,
      scrapeContacts: false,
      scrapeDirectories: false,
      enableCompetitorAnalysis: false,
      scrapeReviewsPersonalData: false,
    });
  });

  it("falls back to baseline and fails when both sources are unusable", async () => {
    const baseline = normalizeRestaurant(place, "google-maps-preview", mapsUrl);
    await expect(
      new LiveRestaurantProvider(
        { load: async () => baseline },
        {
          load: async () => {
            throw new Error("paid detail");
          },
        },
      ).load(mapsUrl),
    ).resolves.toEqual(baseline);
    const conflict = normalizeRestaurant(
      { ...place, title: "Otro Restaurante" },
      "apify-google-maps",
      mapsUrl,
    );
    await expect(
      new LiveRestaurantProvider(
        { load: async () => baseline },
        { load: async () => conflict },
      ).load(mapsUrl),
    ).resolves.toEqual(baseline);
    await expect(
      new LiveRestaurantProvider(
        {
          load: async () => {
            throw new Error("preview detail");
          },
        },
        {
          load: async () => {
            throw new Error("secret detail");
          },
        },
      ).load(mapsUrl),
    ).rejects.toThrow(UnusableRestaurantError);
  });
});
