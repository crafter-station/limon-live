import { z } from "zod";
import { GenerationFailedError } from "@/domain/generation/coordinator";
import { toPublicGenerationStatus } from "@/domain/generation/public-status";
import { DrizzleGenerationRepository } from "@/server/db/generation-repository";
import { createGenerationCoordinator } from "@/server/generation-service";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return Response.json(
      { error: "Invalid generation ID." },
      {
        status: 400,
        headers: NO_STORE_HEADERS,
      },
    );
  }

  try {
    await createGenerationCoordinator().advance(id);
  } catch (error) {
    if (!(error instanceof GenerationFailedError)) {
      const missing = await new DrizzleGenerationRepository().findById(id);
      if (!missing) {
        return Response.json(
          { error: "Generation not found." },
          {
            status: 404,
            headers: NO_STORE_HEADERS,
          },
        );
      }
      throw error;
    }
  }

  const generation = await new DrizzleGenerationRepository().findById(id);
  if (!generation) {
    return Response.json(
      { error: "Generation not found." },
      {
        status: 404,
        headers: NO_STORE_HEADERS,
      },
    );
  }
  return Response.json(toPublicGenerationStatus(generation), {
    headers: NO_STORE_HEADERS,
  });
}
