import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const DEFAULT_POOL_SIZE = 5;

type DatabaseClient = ReturnType<typeof postgres>;

type GlobalDatabaseState = typeof globalThis & {
  __minirosPostgresClients?: Map<string, DatabaseClient>;
};

const globalDatabaseState = globalThis as GlobalDatabaseState;

function getConnectionString(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  return connectionString;
}

export function createPostgresClient(
  connectionString = process.env.DATABASE_URL,
) {
  const resolvedConnectionString = getConnectionString(connectionString);
  const existingClient = globalDatabaseState.__minirosPostgresClients?.get(
    resolvedConnectionString,
  );

  if (existingClient) {
    return existingClient;
  }

  const client = postgres(resolvedConnectionString, {
    prepare: false,
    // Supabase's session pooler has a small per-project connection limit.
    // Keep enough capacity for concurrent page queries without exhausting it.
    max: DEFAULT_POOL_SIZE,
    idle_timeout: 20,
  });

  (globalDatabaseState.__minirosPostgresClients ??= new Map()).set(
    resolvedConnectionString,
    client,
  );

  return client;
}

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  return drizzle(createPostgresClient(connectionString), { schema });
}

export const db = process.env.DATABASE_URL ? createDatabase() : null;

export function requireDatabase() {
  if (!db) {
    throw new Error("DATABASE_URL is required for server workflows.");
  }

  return db;
}

export type Database = ReturnType<typeof createDatabase>;
