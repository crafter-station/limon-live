import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll } from "vitest";
import { generationRepositoryContract } from "@/test/generation-repository-contract";
import { DrizzleGenerationRepository } from "./generation-repository";
import * as schema from "./schema";

const client = new PGlite();
const database = drizzle(client, { schema });

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "./drizzle" });
});

afterAll(async () => {
  await client.close();
});

generationRepositoryContract("Drizzle generation repository", async () => {
  await database.delete(schema.restaurantGenerations);
  return new DrizzleGenerationRepository(database);
});
