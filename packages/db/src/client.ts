import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function getConnectionString(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return connectionString;
}

export function createPostgresClient(
  connectionString = process.env.DATABASE_URL,
) {
  return postgres(getConnectionString(connectionString), {
    prepare: false,
  });
}

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  const client = createPostgresClient(connectionString);

  return drizzle(client, { schema });
}

export const db = process.env.DATABASE_URL
  ? createDatabase(process.env.DATABASE_URL)
  : null;
export type Database = ReturnType<typeof createDatabase>;
