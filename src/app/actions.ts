"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { GenerationFailedError } from "@/domain/generation/coordinator";
import { UnsupportedFixtureUrlError } from "@/domain/generation/fixture-provider";
import { createGenerationCoordinator } from "@/server/generation-service";

export async function submitGeneration(formData: FormData) {
  const sourceUrl = formData.get("sourceUrl");
  let destination: string;

  if (typeof sourceUrl !== "string") {
    destination = "/?error=missing-url";
  } else {
    try {
      const result = await createGenerationCoordinator().submit(sourceUrl);
      destination =
        result.kind === "ready"
          ? `/r/${result.slug}`
          : `/generate/${result.id}`;
    } catch (error) {
      if (!(error instanceof UnsupportedFixtureUrlError)) throw error;
      destination = `/?error=unsupported-url&sourceUrl=${encodeURIComponent(sourceUrl)}`;
    }
  }

  redirect(destination);
}

export async function advanceGeneration(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) redirect("/");

  let destination: string;
  try {
    const result = await createGenerationCoordinator().advance(id);
    destination =
      result.kind === "ready" ? `/r/${result.slug}` : `/generate/${id}`;
  } catch (error) {
    if (!(error instanceof GenerationFailedError)) throw error;
    destination = `/generate/${id}`;
  }
  redirect(destination);
}
