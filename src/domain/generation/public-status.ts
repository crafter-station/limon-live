import type { Generation, GenerationStatus } from "./types";

export type PublicGenerationStatus = {
  status: GenerationStatus;
  slug: string | null;
  error: string | null;
};

export function toPublicGenerationStatus(
  generation: Generation,
): PublicGenerationStatus {
  return {
    status: generation.status,
    slug: generation.status === "ready" ? generation.slug : null,
    error: generation.status === "failed" ? generation.safeError : null,
  };
}
