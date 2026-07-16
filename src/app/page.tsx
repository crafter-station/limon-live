import Link from "next/link";
import { MapsSubmissionForm } from "@/components/maps-submission-form";

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Link className="wordmark" href="/" aria-label="Limon home">
          <span className="brand-mark" aria-hidden="true">
            L
          </span>
          <span>Limon</span>
        </Link>
        <span>Made for neighborhood favorites</span>
      </nav>
      <section className="landing-grid" aria-labelledby="landing-title">
        <div className="landing-copy">
          <p className="eyebrow">From a pin on the map to a place online</p>
          <h1 id="landing-title">
            Your favorite spot deserves its own corner of the internet.
          </h1>
          <p className="lede">
            Paste a Google Maps link. Limon turns public place details into a
            polished Spanish restaurant page that is easy to share.
          </p>
          <MapsSubmissionForm />
        </div>
        <aside
          className="preview-card"
          aria-label="Example restaurant page preview"
        >
          <div className="preview-topline">
            <span className="preview-label">Live page preview</span>
            <span aria-hidden="true">↗</span>
          </div>
          <div className="preview-art" aria-hidden="true">
            <span>LP</span>
          </div>
          <p className="preview-kicker">Miraflores · Lima</p>
          <h2>Las Palmeras</h2>
          <p>Peruvian restaurant · 4.6 ★</p>
          <div className="preview-rule" />
          <p>Everything guests need, gathered in one memorable place.</p>
        </aside>
      </section>
      <section className="steps-section" aria-labelledby="steps-title">
        <p className="eyebrow">Simple by design</p>
        <h2 id="steps-title">A shareable restaurant page in three steps.</h2>
        <ol className="steps-list">
          <li>
            <span>01</span>
            <h3>Paste the place</h3>
            <p>
              Use the full or shortened Google Maps link for the restaurant.
            </p>
          </li>
          <li>
            <span>02</span>
            <h3>Let Limon build</h3>
            <p>
              We safely gather public details and avoid repeating work for the
              same place.
            </p>
          </li>
          <li>
            <span>03</span>
            <h3>Share the page</h3>
            <p>Open a durable Spanish page made for customers on any screen.</p>
          </li>
        </ol>
      </section>
    </main>
  );
}
