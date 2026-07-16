import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getServerEnv } from "@/server/env";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
  const sql = neon(getServerEnv().DATABASE_URL);
  return drizzle(sql, { schema });
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}
