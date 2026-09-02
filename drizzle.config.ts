import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/db/src/schema/index.ts",
  // Supabase CLI only applies files directly under this directory. Keeping
  // Drizzle output here gives local, CI, and hosted deploys one migration path.
  out: "./supabase/migrations",
  dialect: "postgresql",
  schemaFilter: ["public"],
  migrations: {
    prefix: "supabase",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
