"use server";

import { redirect } from "next/navigation";
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
    } catch {
      destination = `/?error=unsupported-url&sourceUrl=${encodeURIComponent(sourceUrl)}`;
    }
  }

  redirect(destination);
}

export async function advanceGeneration(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") redirect("/");

  const result = await createGenerationCoordinator().advance(id);
  redirect(result.kind === "ready" ? `/r/${result.slug}` : `/generate/${id}`);
}
