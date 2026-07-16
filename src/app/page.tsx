import Link from "next/link";
import { submitGeneration } from "@/app/actions";
import { FIXTURE_MAPS_URL } from "@/domain/generation/fixture-provider";

export default async function Home({ searchParams }: PageProps<"/">) {
  const query = await searchParams;
  const hasError = query.error === "unsupported-url";
  const submittedUrl =
    typeof query.sourceUrl === "string" ? query.sourceUrl : FIXTURE_MAPS_URL;

  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Link className="wordmark" href="/">
          Limon
        </Link>
        <span>Fixture edition</span>
      </nav>
      <section className="landing-grid">
        <div className="landing-copy">
          <p className="eyebrow">Maps to menu, minus the busywork</p>
          <h1>Turn a place into a page worth sharing.</h1>
          <p className="lede">
            Submit the supported Las Palmeras Maps fixture. Limon persists the
            generation, builds from local normalized data, and publishes a
            Spanish restaurant page.
          </p>
          <form className="source-form" action={submitGeneration}>
            <label htmlFor="sourceUrl">Google Maps URL</label>
            <div className="form-row">
              <input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                defaultValue={submittedUrl}
                aria-describedby={hasError ? "source-error" : "fixture-note"}
                aria-invalid={hasError}
                required
              />
              <button className="primary-button" type="submit">
                Create my page
              </button>
            </div>
            {hasError ? (
              <p className="error" id="source-error" role="alert">
                This tracer bullet supports only the Las Palmeras fixture URL.
              </p>
            ) : (
              <p id="fixture-note">
                Fixture-only: no paid external service will be contacted.
              </p>
            )}
          </form>
        </div>
        <aside className="preview-card" aria-label="Restaurant page preview">
          <span className="preview-label">A tiny preview</span>
          <div className="preview-art" aria-hidden="true" />
          <h2>Las Palmeras</h2>
          <p>Restaurante peruano · Lima</p>
          <div className="preview-rule" />
          <p>Stored once. Ready to share.</p>
        </aside>
      </section>
    </main>
  );
}
