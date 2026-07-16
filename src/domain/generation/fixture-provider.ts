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
  rating: 4.6,
  reviewCount: 328,
  mapsUrl: FIXTURE_MAPS_URL,
  importedAt: "2026-07-16T00:00:00.000Z",
};

export class UnsupportedFixtureUrlError extends Error {}

export function normalizeFixtureSource(input: string): string {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new UnsupportedFixtureUrlError(
      "Use the supported Las Palmeras Google Maps URL.",
    );
  }

  const fixture = new URL(FIXTURE_MAPS_URL);
  if (
    url.protocol !== "https:" ||
    url.hostname !== fixture.hostname ||
    url.pathname.replace(/\/$/, "") !== fixture.pathname
  ) {
    throw new UnsupportedFixtureUrlError(
      "Use the supported Las Palmeras Google Maps URL.",
    );
  }

  return FIXTURE_NORMALIZED_SOURCE;
}

export class FixtureRestaurantProvider implements RestaurantProvider {
  async load(normalizedSource: string): Promise<NormalizedRestaurant> {
    if (normalizedSource !== FIXTURE_NORMALIZED_SOURCE) {
      throw new Error("Unsupported fixture source.");
    }

    return structuredClone(fixtureRestaurant);
  }
}
