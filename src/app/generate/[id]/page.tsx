import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { GenerationProgress } from "@/components/generation-progress";
import { toPublicGenerationStatus } from "@/domain/generation/public-status";
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
        <p className="eyebrow">Creating your site</p>
        <h1>We’re turning your restaurant into a website.</h1>
        <GenerationProgress
          id={id}
          initialStatus={toPublicGenerationStatus(generation)}
        />
      </section>
    </main>
  );
}
