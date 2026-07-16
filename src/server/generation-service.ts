import "server-only";
import { GenerationCoordinator } from "@/domain/generation/coordinator";
import { FixtureRestaurantProvider } from "@/domain/generation/fixture-provider";
import { DrizzleGenerationRepository } from "@/server/db/generation-repository";

export function createGenerationCoordinator() {
  return new GenerationCoordinator(
    new DrizzleGenerationRepository(),
    new FixtureRestaurantProvider(),
  );
}
