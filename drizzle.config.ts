import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./packages/db/src/schema/index.ts",
  out: "./supabase/migrations/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
