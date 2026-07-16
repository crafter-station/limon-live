import type { NormalizedRestaurant } from "@/domain/restaurant";
import type { RestaurantProvider } from "./types";

export const FIXTURE_MAPS_URL =
  "https://www.google.com/maps/place/Las+Palmeras,+Miraflores,+Lima";

export const FIXTURE_NORMALIZED_SOURCE = FIXTURE_MAPS_URL;

const fixtureRestaurant: NormalizedRestaurant = {
  name: "Restaurante Las Palmeras",
  category: "Restaurante peruano",
  description:
    "Un restaurante peruano en Miraflores, Lima, creado a partir de información pública.",
  address: "Av. Alfredo Benavides 1901, Miraflores",
  city: "Lima",
  phone: "+51 1 445 6789",
  website: null,
  location: { lat: -12.1211, lng: -77.0297 },
  hours: [],
  rating: 4.6,
  reviewCount: 328,
  reviews: [],
  attribution: "Google Maps",
  mapsUrl: FIXTURE_MAPS_URL,
  source: "google-maps-preview",
  diagnostics: { provider: "fixture", warnings: [] },
  importedAt: "2026-07-16T00:00:00.000Z",
};

export class FixtureRestaurantProvider implements RestaurantProvider {
  async load(normalizedSource: string): Promise<NormalizedRestaurant> {
    if (normalizedSource !== FIXTURE_NORMALIZED_SOURCE) {
      throw new Error("Unsupported fixture source.");
    }

    return structuredClone(fixtureRestaurant);
  }
}
