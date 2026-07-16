import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { advanceGeneration } from "@/app/actions";
import { MAX_GENERATION_ATTEMPTS } from "@/domain/generation/types";
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
  if (!z.uuid().safeParse(id).success) notFound();
  const generation = await new DrizzleGenerationRepository().findById(id);

  if (!generation) notFound();
  if (generation.status === "ready" && generation.slug) {
    redirect(`/r/${generation.slug}`);
  }

  return (
    <main className="generation-shell">
      <Link className="wordmark" href="/">
        Limon
      </Link>
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
        {generation.attemptCount < MAX_GENERATION_ATTEMPTS ? (
          <form action={advanceGeneration}>
            <input name="id" type="hidden" value={id} />
            <button className="primary-button" type="submit">
              Build the fixture site
            </button>
          </form>
        ) : (
          <Link href="/">Try another link</Link>
        )}
      </section>
    </main>
  );
}
