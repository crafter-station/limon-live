import { readFileSync } from "node:fs";
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
const previewHtml = readFileSync(
  new URL("./fixtures/google-maps-preview.html", import.meta.url),
  "utf8",
);
const currentPreviewHtml = readFileSync(
  new URL("./fixtures/google-maps-current-preview.html", import.meta.url),
  "utf8",
);
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
    for (const categoryName of [
      "Cafetería",
      "CafeOrCoffeeShop",
      "Restaurante peruano",
      "Peruvian restaurant",
      "Pub",
      "TeaHouse",
      "DessertShop",
      "Sandwich shop",
      "Food truck",
      "Deli",
    ]) {
      expect(() =>
        normalizeRestaurant(
          { ...place, categoryName },
          "apify-google-maps",
          mapsUrl,
        ),
      ).not.toThrow();
    }
    expect(() =>
      normalizeRestaurant(
        { ...place, categoryName: "Restaurant supply store" },
        "apify-google-maps",
        mapsUrl,
      ),
    ).toThrow(UnusableRestaurantError);
    for (const categoryName of [
      "Tea house furniture store",
      "Dessert shop supplier",
      "Sandwich shop equipment",
      "Food truck rental",
      "Deli packaging supplier",
      "Cafetería equipment supplier",
      "Panadería alquiler de equipos",
      "Pastelería proveedor",
      "Restaurante proveedor",
      "Restaurante equipos",
      "Restaurante alquiler",
    ]) {
      expect(() =>
        normalizeRestaurant(
          { ...place, categoryName },
          "apify-google-maps",
          mapsUrl,
        ),
      ).toThrow(UnusableRestaurantError);
    }
    for (const invalid of [null, "", false]) {
      expect(() =>
        normalizeRestaurant(
          { ...place, location: { lat: invalid, lng: -77.03 } },
          "apify-google-maps",
          mapsUrl,
        ),
      ).toThrow(UnusableRestaurantError);
    }
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
    expect(() =>
      parseGoogleMapsPreview(
        previewHtml.replace(
          "</head>",
          '<script type="application/ld+json">{}</script></head>',
        ),
      ),
    ).toThrow(UnusableRestaurantError);
    expect(() =>
      parseGoogleMapsPreview(
        previewHtml.replace(
          '<script type="application/ld+json">',
          '<script type="application/ld+json">not-json</script><script type="application/ld+json">',
        ),
      ),
    ).toThrow(UnusableRestaurantError);
    expect(() =>
      parseGoogleMapsPreview(
        '<script type="application/ld+json">not-json</script>',
      ),
    ).toThrow(UnusableRestaurantError);
    expect(() =>
      parseGoogleMapsPreview(
        '<script type="application/ld+json">{"name":"Sparse"}</script>',
      ),
    ).toThrow(UnusableRestaurantError);
    expect(() => parseGoogleMapsPreview(currentPreviewHtml)).toThrow(
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
    ).resolves.toMatchObject({
      name: "Casa Sol",
      city: "Cusco",
      category: "Restaurante",
      description: "Casa Sol: restaurante en Cusco.",
    });
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
      reviewsOrigin: "google",
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

  it("accepts equivalent canonical paid-result URLs", async () => {
    const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    const requestedUrl = `https://www.google.com/maps?place_id=${placeId}`;
    const returnedUrl = `https://www.google.com/maps/place/Cafe/data=!4m2!3m1!19s${placeId}`;
    const provider = new ApifyGoogleMapsProvider(
      "private-token",
      vi.fn(
        async () =>
          new Response(JSON.stringify([{ ...place, url: returnedUrl }]), {
            status: 200,
          }),
      ) as typeof fetch,
    );

    await expect(provider.load(requestedUrl)).resolves.toMatchObject({
      name: "Café Limón",
      mapsUrl: requestedUrl,
    });
  });

  it("rejects stable identity returned for path-only input without independent evidence", async () => {
    const placeId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
    const returnedUrl = `${mapsUrl}?query_place_id=${placeId}`;
    const provider = new ApifyGoogleMapsProvider(
      "private-token",
      vi.fn(
        async () =>
          new Response(JSON.stringify([{ ...place, url: returnedUrl }]), {
            status: 200,
          }),
      ) as typeof fetch,
    );

    await expect(provider.load(mapsUrl)).rejects.toThrow(
      UnusableRestaurantError,
    );

    const sameNameDifferentVenue = new ApifyGoogleMapsProvider(
      "private-token",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                ...place,
                address: "Calle Norte 99, Barranco",
                city: "Barranco",
                location: { lat: -12.15, lng: -77.02 },
                url: returnedUrl,
              },
            ]),
            { status: 200 },
          ),
      ) as typeof fetch,
    );
    await expect(sameNameDifferentVenue.load(mapsUrl)).rejects.toThrow(
      UnusableRestaurantError,
    );
  });

  it("rejects malformed paid-provider responses", async () => {
    for (const body of [
      "not json",
      "{}",
      "[]",
      JSON.stringify([place, place]),
    ]) {
      const provider = new ApifyGoogleMapsProvider(
        "private-token",
        vi.fn(async () => new Response(body, { status: 200 })) as typeof fetch,
      );
      await expect(provider.load(mapsUrl)).rejects.toThrow(
        "Restaurant data could not be verified.",
      );
    }
    const provider = new ApifyGoogleMapsProvider(
      "private-token",
      vi.fn(
        async () => new Response("unavailable", { status: 503 }),
      ) as typeof fetch,
    );
    await expect(provider.load(mapsUrl)).rejects.toThrow(
      "Restaurant data could not be verified.",
    );

    const mismatched = new ApifyGoogleMapsProvider(
      "private-token",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              { ...place, url: "https://www.google.com/maps/place/Other" },
            ]),
            { status: 200 },
          ),
      ) as typeof fetch,
    );
    await expect(mismatched.load(mapsUrl)).rejects.toThrow(
      "Restaurant data could not be verified.",
    );
  });

  it("creates category-neutral factual copy", () => {
    expect(
      normalizeRestaurant(
        { ...place, title: "Pan del Sol", categoryName: "Panadería" },
        "apify-google-maps",
        mapsUrl,
      ).description,
    ).toBe("Pan del Sol: panadería en Lima.");
    expect(
      normalizeRestaurant(
        { ...place, categoryName: "Peruvian restaurant" },
        "apify-google-maps",
        mapsUrl,
      ).description,
    ).toBe("Café Limón: restaurante en Lima.");
    expect(
      normalizeRestaurant(
        { ...place, categoryName: "Food truck" },
        "apify-google-maps",
        mapsUrl,
      ).description,
    ).toBe("Café Limón: puesto de comida en Lima.");
  });

  it("returns successful enrichment with or without a baseline", async () => {
    const baseline = normalizeRestaurant(place, "google-maps-preview", mapsUrl);
    const enriched = normalizeRestaurant(place, "apify-google-maps", mapsUrl);
    await expect(
      new LiveRestaurantProvider(
        {
          load: async () => {
            throw new Error("preview detail");
          },
        },
        { load: async () => enriched },
      ).load(mapsUrl),
    ).resolves.toEqual(enriched);
    await expect(
      new LiveRestaurantProvider(
        { load: async () => baseline },
        { load: async () => enriched },
      ).load(mapsUrl),
    ).resolves.toEqual(enriched);
  });

  it("falls back only for unusable enrichment and fails closed on conflicts", async () => {
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
    ).rejects.toThrow(UnusableRestaurantError);
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
    ).rejects.toThrow(UnusableRestaurantError);
    const conflictingAddress = normalizeRestaurant(
      { ...place, address: "Calle Norte 99, Barranco", city: "Barranco" },
      "apify-google-maps",
      mapsUrl,
    );
    const conflictingCoordinates = normalizeRestaurant(
      { ...place, location: { lat: -12.15, lng: -77.02 } },
      "apify-google-maps",
      mapsUrl,
    );
    for (const partialConflict of [
      conflictingAddress,
      conflictingCoordinates,
    ]) {
      await expect(
        new LiveRestaurantProvider(
          { load: async () => baseline },
          { load: async () => partialConflict },
        ).load(mapsUrl),
      ).rejects.toThrow(UnusableRestaurantError);
    }
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
