import Link from "next/link";
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

  return (
    <main className="restaurant-page" lang="es">
      <nav className="restaurant-nav" aria-label="Navegación principal">
        <Link className="wordmark" href="/">
          Limon
        </Link>
        <a href={restaurant.mapsUrl}>Cómo llegar</a>
      </nav>
      <header className="restaurant-hero">
        <div className="hero-orbit" aria-hidden="true" />
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
      </header>
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
