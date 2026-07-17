import Link from "next/link";
import Image from "next/image";
import type { StoredRestaurant } from "@/domain/restaurant";

export function RestaurantSite({
  restaurant,
}: {
  restaurant: StoredRestaurant;
}) {
  const importedDate = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "America/Lima",
  }).format(new Date(restaurant.importedAt));
  const heroPhoto = restaurant.photos[0];

  return (
    <main className="restaurant-page" lang="es">
      <nav className="restaurant-nav" aria-label="Navegación principal">
        <Link className="wordmark" href="/">
          Limon
        </Link>
        <a href={restaurant.mapsUrl}>Cómo llegar</a>
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
          <p>{restaurant.description}</p>
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
          </div>
        </div>
        {heroPhoto?.attribution ? (
          <p className="hero-attribution">Foto: {heroPhoto.attribution}</p>
        ) : null}
      </header>
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
      {restaurant.reviews.length ? (
        <section className="reviews-section" aria-labelledby="reviews-title">
          <p className="eyebrow">Reseñas</p>
          <h2 id="reviews-title">Lo que dicen en Google</h2>
          <div className="review-grid">
            {restaurant.reviews.map((review, index) => {
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
        </section>
      ) : null}
      <section className="visit-section">
        <div>
          <p className="eyebrow">Visítanos</p>
          <h2>Te esperamos en {restaurant.city}</h2>
          <p>{restaurant.address}</p>
        </div>
        <div className="visit-actions">
          <a className="primary-button" href={restaurant.mapsUrl}>
            Ver en Google Maps
          </a>
          {restaurant.phone ? (
            <a href={`tel:${restaurant.phone}`}>Llamar</a>
          ) : null}
        </div>
      </section>
      <footer className="restaurant-footer">
        <p>Información importada el {importedDate}.</p>
        <p>Fuente: {restaurant.attribution}.</p>
        <p>
          Sitio generado automáticamente por Limon con información pública. No
          verificado por el restaurante.
        </p>
      </footer>
    </main>
  );
}
