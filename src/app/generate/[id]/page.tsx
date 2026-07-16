import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { advanceGeneration } from "@/app/actions";
import { DrizzleGenerationRepository } from "@/server/db/generation-repository";

export const metadata: Metadata = {
  title: "Generate your restaurant site | Limon",
  robots: { index: false, follow: false },
};

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const generation = await new DrizzleGenerationRepository().findById(id);

  if (!generation) notFound();
  if (generation.status === "ready" && generation.slug) {
    redirect(`/r/${generation.slug}`);
  }

  return (
    <main className="generation-shell">
      <a className="wordmark" href="/">
        Limon
      </a>
      <section className="generation-card">
        <p className="eyebrow">Fixture generation</p>
        <h1>Your restaurant page is ready to build.</h1>
        <p>
          Advance this persisted generation through the local fixture provider.
          No Google, Apify, Blob, or AI request will be made.
        </p>
        {generation.safeError ? (
          <p className="error" role="alert">
            {generation.safeError}
          </p>
        ) : null}
        <form action={advanceGeneration}>
          <input name="id" type="hidden" value={id} />
          <button className="primary-button" type="submit">
            Build the fixture site
          </button>
        </form>
      </section>
    </main>
  );
}
