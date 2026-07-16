import { describe, expect, it, vi } from "vitest";
import {
  APIFY_ACTOR_TIMEOUT_SECONDS,
  APIFY_CLIENT_TIMEOUT_MS,
  APIFY_INPUT,
  ApifyGoogleMapsProvider,
  GoogleMapsPreviewProvider,
  LiveRestaurantProvider,
  PREVIEW_TIMEOUT_MS,
  UnusableRestaurantError,
  normalizeRestaurant,
  parseGoogleMapsPreview,
} from "./live-provider";

const mapsUrl = "https://www.google.com/maps/place/Cafe+Limon";
const previewHtml = `<script type="application/ld+json">${JSON.stringify({ "@type": "Restaurant", name: "Casa Sol", servesCuisine: "Restaurante peruano", address: { streetAddress: "Av. Sol 4", addressLocality: "Cusco" }, geo: { latitude: -13.52, longitude: -71.97 } })}</script>`;
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
      description: "Café Limón: café en Lima.",
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
    for (const location of [
      { lat: 91, lng: -77.03 },
      { lat: -12.12, lng: 181 },
    ]) {
      expect(() =>
        normalizeRestaurant(
          { ...place, location },
          "apify-google-maps",
          mapsUrl,
        ),
      ).toThrow(UnusableRestaurantError);
    }
  });

  it("isolates parsing of a realistic public preview", () => {
    expect(parseGoogleMapsPreview(previewHtml)).toMatchObject({
      name: "Casa Sol",
      addressLocality: "Cusco",
    });
    expect(() => parseGoogleMapsPreview("<html></html>")).toThrow(
      UnusableRestaurantError,
    );
  });

  it("loads and normalizes the public preview with bounded Spanish requests", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetcher = vi.fn(
      async () => new Response(previewHtml, { status: 200 }),
    );
    await expect(
      new GoogleMapsPreviewProvider(fetcher as typeof fetch).load(mapsUrl),
    ).resolves.toMatchObject({ name: "Casa Sol", city: "Cusco" });
    expect(fetcher).toHaveBeenCalledWith(
      mapsUrl,
      expect.objectContaining({ headers: { "accept-language": "es" } }),
    );
    expect(timeout).toHaveBeenCalledWith(PREVIEW_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it("rejects malformed and non-OK preview responses", async () => {
    for (const response of [
      new Response("<html></html>", { status: 200 }),
      new Response("unavailable", { status: 503 }),
    ]) {
      const provider = new GoogleMapsPreviewProvider(
        vi.fn(async () => response) as typeof fetch,
      );
      await expect(provider.load(mapsUrl)).rejects.toThrow(
        UnusableRestaurantError,
      );
    }
  });

  it("bounds paid requests and keeps credentials out of URLs", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
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
    expect(url).toContain(
      `timeout=${APIFY_ACTOR_TIMEOUT_SECONDS}&maxItems=1&maxTotalChargeUsd=0.5`,
    );
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
      scrapeImageAuthors: false,
      enableCompetitorAnalysis: false,
      scrapeReviewsPersonalData: false,
    });
    expect(timeout).toHaveBeenCalledWith(APIFY_CLIENT_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it("creates category-neutral factual copy", () => {
    expect(
      normalizeRestaurant(
        { ...place, title: "Pan del Sol", categoryName: "Panadería" },
        "apify-google-maps",
        mapsUrl,
      ).description,
    ).toBe("Pan del Sol: panadería en Lima.");
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
    const sameNameDifferentVenue = normalizeRestaurant(
      {
        ...place,
        address: "Calle Norte 99, Barranco",
        city: "Barranco",
        location: { lat: -12.15, lng: -77.02 },
      },
      "apify-google-maps",
      mapsUrl,
    );
    await expect(
      new LiveRestaurantProvider(
        { load: async () => baseline },
        { load: async () => sameNameDifferentVenue },
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
