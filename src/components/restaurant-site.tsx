import Image from "next/image";
import Link from "next/link";
import type { Menu } from "@/domain/menu";
import type { StoredRestaurant } from "@/domain/restaurant";
import {
  openingStatus,
  safeWebsite,
  selectedReviews,
} from "@/domain/restaurant-presentation";

export function RestaurantSite({
  restaurant,
  slug,
  menu = null,
}: {
  restaurant: StoredRestaurant;
  slug?: string;
  menu?: Menu | null;
}) {
  const importedDate = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "America/Lima",
  }).format(new Date(restaurant.importedAt));
  const heroPhoto = restaurant.photos[0];
  const reviews = selectedReviews(restaurant.reviews);
  const website = safeWebsite(restaurant.website);
  const status = openingStatus(restaurant.hours);
  const stableSlug = encodeURIComponent(
    slug ??
      restaurant.name
        .toLocaleLowerCase("es")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
  );
  const mapEmbed = restaurant.location
    ? `https://www.google.com/maps?q=${restaurant.location.lat},${restaurant.location.lng}&z=16&output=embed`
    : null;

  return (
    <main className="restaurant-page" lang="es">
      <nav className="restaurant-nav" aria-label="Navegación principal">
        <Link className="wordmark" href="/">
          Limon
        </Link>
        <a href={restaurant.mapsUrl} rel="nofollow noreferrer">
          Cómo llegar
        </a>
      </nav>
      <header
        className={`restaurant-hero ${heroPhoto ? "restaurant-hero-photo" : "restaurant-hero-fallback"}`}
      >
        {heroPhoto ? (
          <Image
            className="restaurant-hero-image"
            src={heroPhoto.url}
            alt={heroPhoto.alt}
            fill
            sizes="100vw"
            unoptimized
          />
        ) : (
          <div className="hero-orbit" aria-hidden="true" />
        )}
        <div className="restaurant-hero-copy">
          <p className="eyebrow">{restaurant.category}</p>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.address}</p>
          <div className="restaurant-facts">
            {restaurant.rating !== null ? (
              <span>
                {restaurant.rating.toFixed(1)} en Google
                {restaurant.reviewCount !== null
                  ? ` · ${restaurant.reviewCount} reseñas`
                  : ""}
              </span>
            ) : null}
            <span>{restaurant.city}</span>
            {status ? <span>{status}</span> : null}
          </div>
        </div>
        {heroPhoto?.attribution ? (
          <p className="hero-attribution">Foto: {heroPhoto.attribution}</p>
        ) : null}
      </header>
      <section className="story-section" aria-labelledby="story-title">
        <p className="eyebrow">La historia del lugar</p>
        <h2 id="story-title">Una mesa por descubrir</h2>
        <p>{restaurant.description}</p>
        <div className="story-actions">
          {restaurant.phone ? (
            <a href={`tel:${restaurant.phone}`}>Llamar</a>
          ) : null}
          {website ? (
            <a href={website} rel="nofollow noopener noreferrer">
              Sitio oficial
            </a>
          ) : null}
        </div>
      </section>
      {restaurant.photos.length > 1 ? (
        <section className="restaurant-gallery" aria-labelledby="gallery-title">
          <p className="eyebrow">Galería</p>
          <h2 id="gallery-title">Una mirada al lugar</h2>
          <div className="gallery-grid">
            {restaurant.photos.slice(1).map((photo) => (
              <figure key={photo.url}>
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  width={1200}
                  height={900}
                  sizes="(max-width: 800px) 100vw, 50vw"
                  unoptimized
                />
                {photo.attribution ? (
                  <figcaption>Foto: {photo.attribution}</figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}
      {menu ? (
        <section className="menu-section" aria-labelledby="menu-title">
          <p className="eyebrow">Menú referencial</p>
          <h2 id="menu-title">Una mirada a la carta</h2>
          <p className="menu-warning">
            Extraído automáticamente de fotos públicas, sin revisión del
            restaurante. Los platos, precios y disponibilidad pueden haber
            cambiado.
          </p>
          <div className="menu-grid">
            {menu.sections.map((section, sectionIndex) => (
              <article key={`${section.name ?? "sección"}-${sectionIndex}`}>
                {section.name ? <h3>{section.name}</h3> : null}
                <ul>
                  {section.items.map((item, itemIndex) => (
                    <li key={`${item.name}-${itemIndex}`}>
                      <div className="menu-item-heading">
                        <strong>{item.name}</strong>
                        {item.price ? (
                          <span>
                            {item.price.label ? `${item.price.label} · ` : ""}
                            {new Intl.NumberFormat("es-PE", {
                              style: "currency",
                              currency: "PEN",
                            }).format(Number(item.price.amount))}
                          </span>
                        ) : null}
                      </div>
                      {item.description ? <p>{item.description}</p> : null}
                      {item.variants.length ? (
                        <dl>
                          {item.variants.map((variant) => (
                            <div
                              key={`${variant.name}-${variant.price.amount}`}
                            >
                              <dt>{variant.name}</dt>
                              <dd>
                                {variant.price.label
                                  ? `${variant.price.label} · `
                                  : ""}
                                {new Intl.NumberFormat("es-PE", {
                                  style: "currency",
                                  currency: "PEN",
                                }).format(Number(variant.price.amount))}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {reviews.length || restaurant.rating !== null ? (
        <section className="reviews-section" aria-labelledby="reviews-title">
          <p className="eyebrow">Reseñas</p>
          <h2 id="reviews-title">Lo que dicen en Google</h2>
          {reviews.length ? (
            <div className="review-grid">
              {reviews.map((review, index) => {
                const initials = (review.author ?? "Visitante")
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toLocaleUpperCase("es");
                return (
                  <article key={`${review.author ?? "visitante"}-${index}`}>
                    <span className="review-initials" aria-hidden="true">
                      {initials}
                    </span>
                    <p>{review.text}</p>
                    <strong>{review.author ?? "Visitante de Google"}</strong>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="review-fallback">
              {restaurant.rating?.toFixed(1)} de 5 en Google. Consulta las
              reseñas completas para conocer más perspectivas.
            </p>
          )}
          <a
            className="inverse-link"
            href={restaurant.mapsUrl}
            rel="nofollow noreferrer"
          >
            Ver todas las reseñas en Google Maps
          </a>
        </section>
      ) : null}
      <section className="visit-section" aria-labelledby="visit-title">
        <div className="visit-copy">
          <p className="eyebrow">Visítanos</p>
          <h2 id="visit-title">Planifica tu visita</h2>
          <p>{restaurant.address}</p>
          {restaurant.hours.length ? (
            <div className="hours-block">
              <h3>Horarios publicados</h3>
              <dl>
                {restaurant.hours.map((entry) => (
                  <div key={`${entry.day}-${entry.hours}`}>
                    <dt>{entry.day}</dt>
                    <dd>{entry.hours}</dd>
                  </div>
                ))}
              </dl>
              {!status ? <p>Confirma el horario antes de ir.</p> : null}
            </div>
          ) : null}
        </div>
        <div className="map-card">
          {mapEmbed ? (
            <iframe
              src={mapEmbed}
              title={`Mapa de ${restaurant.name}`}
              loading="eager"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="map-fallback">Mapa no disponible</div>
          )}
          <a
            className="primary-button"
            href={restaurant.mapsUrl}
            rel="nofollow noreferrer"
          >
            Cómo llegar en Google Maps
          </a>
        </div>
      </section>
      <footer className="restaurant-footer">
        <div>
          <Link className="wordmark" href="/">
            Limon
          </Link>
          <p>Made with limon</p>
        </div>
        <div>
          <p>
            Información importada el {importedDate}. Fuente:{" "}
            {restaurant.attribution}.
          </p>
          <p>
            URL estable:{" "}
            <a href={`https://${stableSlug}.limon.lat/`}>
              {stableSlug}.limon.lat
            </a>
          </p>
          <p>
            Página independiente creada automáticamente con información pública.
            No verificado por el restaurante; no es su sitio oficial.
          </p>
        </div>
      </footer>
    </main>
  );
}
