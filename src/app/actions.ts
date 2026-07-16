"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { GenerationFailedError } from "@/domain/generation/coordinator";
import {
  MapsUrlResolutionError,
  UnsupportedMapsUrlError,
} from "@/domain/generation/maps-url";
import type { SubmissionFormState } from "@/domain/generation/submission-form";
import {
  consumeSubmissionLimit,
  createGenerationCoordinator,
} from "@/server/generation-service";
import { getRequesterAddress } from "@/server/submission-security";

export async function submitGeneration(
  _previousState: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  const submittedValue = formData.get("sourceUrl");
  const sourceUrl = typeof submittedValue === "string" ? submittedValue : "";
  let destination: string;

  if (!sourceUrl.trim()) {
    return { sourceUrl, error: "Enter a Google Maps place link." };
  }

  const allowed = await consumeSubmissionLimit(
    getRequesterAddress(await headers()),
  );
  if (!allowed) {
    return {
      sourceUrl,
      error:
        "Too many links submitted. Try again at the start of the next hour.",
    };
  }

  try {
    const result = await createGenerationCoordinator().submit(sourceUrl);
    destination =
      result.kind === "ready" ? `/r/${result.slug}` : `/generate/${result.id}`;
  } catch (error) {
    if (error instanceof UnsupportedMapsUrlError) {
      return {
        sourceUrl,
        error:
          "Enter a supported HTTPS Google Maps place link, not a search or lookalike link.",
      };
    }
    if (error instanceof MapsUrlResolutionError) {
      return {
        sourceUrl,
        error:
          "We couldn't open that short link. Try again or paste the full Google Maps place link.",
      };
    }
    throw error;
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
