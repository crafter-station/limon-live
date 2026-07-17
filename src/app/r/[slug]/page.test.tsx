import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIXTURE_NORMALIZED_SOURCE,
  FixtureRestaurantProvider,
} from "@/domain/generation/fixture-provider";

const findReadyBySlug = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/generation-repository", () => ({
  DrizzleGenerationRepository: class {
    findReadyBySlug = findReadyBySlug;
  },
}));

import PublishedRestaurantPage, { metadata } from "./page";

describe("published restaurant page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a sparse stored page without invoking the provider", async () => {
    const provider = new FixtureRestaurantProvider();
    const data = await provider.load(FIXTURE_NORMALIZED_SOURCE);
    const sparseData = {
      ...data,
      phone: null,
      website: "javascript:alert(1)",
      location: null,
      hours: [],
      rating: null,
      reviewCount: null,
      reviews: [],
    };
    const load = vi.spyOn(FixtureRestaurantProvider.prototype, "load");
    findReadyBySlug.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      sourceUrl: FIXTURE_NORMALIZED_SOURCE,
      normalizedSource: FIXTURE_NORMALIZED_SOURCE,
      status: "ready",
      providerCheckpoint: data,
      publishedData: sparseData,
      slug: "las-palmeras",
      safeError: null,
      leaseToken: null,
      leaseAcquiredAt: null,
      attemptCount: 1,
      createdAt: new Date("2026-07-16T10:00:00.000Z"),
      updatedAt: new Date("2026-07-16T10:00:00.000Z"),
    });

    const page = await PublishedRestaurantPage({
      params: Promise.resolve({ slug: "las-palmeras" }),
    });
    const html = renderToStaticMarkup(page);

    expect(findReadyBySlug).toHaveBeenCalledWith("las-palmeras");
    expect(load).not.toHaveBeenCalled();
    expect(html).toContain("Restaurante Las Palmeras");
    expect(html).toContain(sparseData.category);
    expect(html).toContain(sparseData.description);
    expect(html).toContain(sparseData.city);
    expect(html).toContain(sparseData.address);
    expect(html).toContain("Cómo llegar en Google Maps");
    expect(html).toContain(sparseData.mapsUrl);
    expect(html).toContain("Información importada el");
    expect(html).toContain("Fuente: Google Maps");
    expect(html).toContain("No verificado por el restaurante");
    expect(html).not.toContain("Llamar");
    expect(html).not.toContain("Sitio oficial");
    expect(html).not.toContain("reseñas");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Mapa no disponible");
    expect(html).toContain("restaurant-hero-fallback");
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe("Restaurante en Perú | Limon");
    expect(metadata.description).toContain("Información pública");
  });

  it("keeps legacy immutable publications readable", async () => {
    findReadyBySlug.mockResolvedValue({
      publishedData: {
        name: "Café Antiguo",
        category: "Café",
        description: "Café Antiguo: café en Lima.",
        address: "Calle Lima 1",
        city: "Lima",
        phone: null,
        rating: null,
        reviewCount: null,
        mapsUrl: FIXTURE_NORMALIZED_SOURCE,
        importedAt: "2026-07-01T00:00:00.000Z",
      },
    });

    const page = await PublishedRestaurantPage({
      params: Promise.resolve({ slug: "cafe-antiguo" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Café Antiguo");
    expect(html).toContain("Fuente: Google Maps");
    expect(html).toContain("restaurant-hero-fallback");
  });

  it("renders retained place photos, attribution, and initials without reviewer imagery", async () => {
    const data = await new FixtureRestaurantProvider().load(
      FIXTURE_NORMALIZED_SOURCE,
    );
    findReadyBySlug.mockResolvedValue({
      publishedData: {
        ...data,
        photos: [
          {
            url: "https://store.public.blob.vercel-storage.com/hero.jpg",
            alt: "Fachada de Restaurante Las Palmeras",
            attribution: "María P.",
          },
          {
            url: "https://store.public.blob.vercel-storage.com/dining.jpg",
            alt: "Comedor de Restaurante Las Palmeras",
            attribution: "Google Maps",
          },
        ],
        reviews: [
          {
            author: "Ana Pérez",
            text: "Excelente comida.",
            rating: 5,
            publishedAt: "2026-05-01T00:00:00.000Z",
            profilePhotoUrl: "https://lh3.googleusercontent.com/avatar",
          },
          {
            author: "Luis Mora",
            text: "Servicio atento.",
            rating: 4,
            publishedAt: "2026-06-01T00:00:00.000Z",
          },
        ],
        website: "https://restaurant.example/menu",
        hours: [{ day: "lunes", hours: "09:00-18:00" }],
      },
    });

    const page = await PublishedRestaurantPage({
      params: Promise.resolve({ slug: "las-palmeras" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("restaurant-hero-photo");
    expect(html).toContain("Fachada de Restaurante Las Palmeras");
    expect(html).toContain("Comedor de Restaurante Las Palmeras");
    expect(html).toContain("Foto: María P.");
    expect(html).toContain("Foto: Google Maps");
    expect(html).toContain(
      "https://store.public.blob.vercel-storage.com/hero.jpg",
    );
    expect(html).not.toContain("/_next/image");
    expect(html).toContain("review-initials");
    expect(html).toContain("AP");
    expect(html.indexOf("Servicio atento.")).toBeLessThan(
      html.indexOf("Excelente comida."),
    );
    expect(html).not.toContain("googleusercontent.com/avatar");
    expect(html).toContain("Sitio oficial");
    expect(html).toContain("nofollow noopener noreferrer");
    expect(html).toContain("Horarios publicados");
    expect(html).toContain("<iframe");
    expect(html).toContain("q=-12.1211,-77.0297");
    expect(html).toContain('loading="eager"');
    expect(html).toContain("Ver todas las reseñas en Google Maps");
    expect(html).toContain("limon.live/r/las-palmeras");
    expect(html).toContain("Made with limon");
    expect(html).toContain("no es su sitio oficial");
  });

  it("uses aggregate rating as the review fallback", async () => {
    const data = await new FixtureRestaurantProvider().load(
      FIXTURE_NORMALIZED_SOURCE,
    );
    findReadyBySlug.mockResolvedValue({
      publishedData: { ...data, reviews: [] },
    });

    const page = await PublishedRestaurantPage({
      params: Promise.resolve({ slug: "las-palmeras" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("4.6 de 5 en Google");
    expect(html).toContain("Consulta las reseñas completas");
    expect(html).toContain("Ver todas las reseñas en Google Maps");
  });
});
