import { readFileSync } from "node:fs";
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

import PublishedRestaurantPage, { generateMetadata } from "./page";

describe("published restaurant page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
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
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "las-palmeras" }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.title).toBe("Restaurante en Perú | Limon");
    expect(metadata.description).toContain("Información pública");
    expect(metadata.alternates?.canonical).toBe(
      "https://las-palmeras.limon.lat/",
    );
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
          {
            author: "Rosa Díaz",
            text: "Sabores memorables.",
            rating: 5,
            publishedAt: "2026-04-01T00:00:00.000Z",
          },
          {
            author: "Mario Sol",
            text: "Esta cuarta reseña no se muestra.",
            rating: 3,
            publishedAt: "2026-03-01T00:00:00.000Z",
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
    expect(html).toContain(`href="tel:${data.phone}"`);
    expect(html).toContain("Llamar");
    expect(html).toContain("Sabores memorables.");
    expect(html).not.toContain("Esta cuarta reseña no se muestra.");
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

  it("renders exact and overnight opening boundaries in Lima time", async () => {
    const data = await new FixtureRestaurantProvider().load(
      FIXTURE_NORMALIZED_SOURCE,
    );
    findReadyBySlug.mockResolvedValue({
      publishedData: {
        ...data,
        hours: [
          { day: "domingo", hours: "cerrado" },
          { day: "lunes", hours: "cerrado" },
          { day: "martes", hours: "cerrado" },
          { day: "miércoles", hours: "cerrado" },
          { day: "jueves", hours: "cerrado" },
          { day: "viernes", hours: "18:00-02:00" },
          { day: "sábado", hours: "10:00-14:00" },
        ],
      },
    });
    vi.useFakeTimers();

    const statusAt = async (instant: string) => {
      vi.setSystemTime(new Date(instant));
      const page = await PublishedRestaurantPage({
        params: Promise.resolve({ slug: "las-palmeras" }),
      });
      return renderToStaticMarkup(page);
    };

    expect(await statusAt("2026-07-17T23:00:00Z")).toContain("Abierto ahora");
    expect(await statusAt("2026-07-18T06:59:00Z")).toContain("Abierto ahora");
    expect(await statusAt("2026-07-18T07:00:00Z")).toContain("Cerrado ahora");
    expect(await statusAt("2026-07-18T15:00:00Z")).toContain("Abierto ahora");
    expect(await statusAt("2026-07-18T19:00:00Z")).toContain("Cerrado ahora");
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

  it("renders referential menu variants, null details, and PEN and omits no-menu outcomes", async () => {
    const data = await new FixtureRestaurantProvider().load(
      FIXTURE_NORMALIZED_SOURCE,
    );
    findReadyBySlug.mockResolvedValue({
      publishedData: data,
      menuStatus: "published",
      menuData: {
        sections: [
          {
            name: null,
            items: [
              {
                name: "Ceviche clásico",
                description: null,
                price: null,
                variants: [
                  {
                    name: "Fuente",
                    price: { label: "Grande", amount: "49.5", currency: "PEN" },
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const html = renderToStaticMarkup(
      await PublishedRestaurantPage({
        params: Promise.resolve({ slug: "las-palmeras" }),
      }),
    );
    expect(html).toContain("Menú referencial");
    expect(html).toContain("sin revisión del restaurante");
    expect(html).toContain("Ceviche clásico");
    expect(html).toContain("Fuente");
    expect(html).toMatch(/Grande · S\/\.?\s*49[,.]50/);

    findReadyBySlug.mockResolvedValue({
      publishedData: data,
      menuStatus: "none",
      menuData: null,
    });
    const withoutMenu = renderToStaticMarkup(
      await PublishedRestaurantPage({
        params: Promise.resolve({ slug: "las-palmeras" }),
      }),
    );
    expect(withoutMenu).not.toContain("Menú referencial");
  });

  it("provides sized story actions and contrasting restaurant focus rings", () => {
    const css = readFileSync(
      new URL("../../globals.css", import.meta.url),
      "utf8",
    );
    expect(css).toMatch(
      /\.story-actions > a\s*{[^}]*min-width: 44px;[^}]*min-height: 44px;/,
    );
    expect(css).toMatch(
      /\.restaurant-page :focus-visible\s*{[^}]*outline: 3px solid var\(--paper\);[^}]*box-shadow: 0 0 0 8px var\(--ink\);/,
    );

    const luminance = (hex: string) => {
      const channels = hex
        .match(/[\da-f]{2}/gi)
        ?.map((value) => Number.parseInt(value, 16) / 255);
      if (!channels) throw new Error(`Invalid color: ${hex}`);
      const [red, green, blue] = channels.map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (first: string, second: string) => {
      const lighter = Math.max(luminance(first), luminance(second));
      const darker = Math.min(luminance(first), luminance(second));
      return (lighter + 0.05) / (darker + 0.05);
    };

    expect(contrast("#183a2d", "#f5f0df")).toBeGreaterThanOrEqual(3);
    expect(contrast("#fffdf5", "#183a2d")).toBeGreaterThanOrEqual(3);
  });

  it("collapses the menu grid at the repository mobile breakpoint", () => {
    const css = readFileSync(
      new URL("../../globals.css", import.meta.url),
      "utf8",
    );
    expect(css).toMatch(
      /@media \(max-width: 800px\) \{\s*\.landing-grid,\s*\.story-section,\s*\.visit-section,\s*\.restaurant-footer,\s*\.gallery-grid,\s*\.menu-grid,\s*\.review-grid \{\s*grid-template-columns: 1fr;/,
    );
  });
});
