import { z } from "zod";
import { toPublicGenerationStatus } from "@/domain/generation/public-status";
import { DrizzleGenerationRepository } from "@/server/db/generation-repository";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(
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
