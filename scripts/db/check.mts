import { loadEnvFile } from "node:process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { missingDatabaseColumns } from "../../packages/db/src/schema-check";

async function checkDatabase() {
  let client:
    | ReturnType<
        (typeof import("../../packages/db/src/client"))["createPostgresClient"]
      >
    | undefined;
  try {
    // Match the web app's database unless the caller explicitly supplies another.
    const webEnv = fileURLToPath(
      new URL("../../apps/web/.env.local", import.meta.url),
    );
    if (!process.env.DATABASE_URL && existsSync(webEnv)) loadEnvFile(webEnv);

    if (!process.env.DATABASE_URL) {
      console.error("Set DATABASE_URL or configure apps/web/.env.local first.");
      process.exitCode = 1;
      return;
    }

    // Import inside the guard: the module also initializes its exported db.
    const { createPostgresClient } =
      await import("../../packages/db/src/client");
    client = createPostgresClient();
    await client.begin("read only", async (transaction) => {
      const columns = await transaction<
        {
          table_schema: string;
          table_name: string;
          column_name: string;
        }[]
      >`
        select table_schema, table_name, column_name
        from information_schema.columns
        where table_schema in ('public', 'auth')
      `;
      const missing = missingDatabaseColumns(columns);
      const hasHistory = await transaction`
        select to_regclass('supabase_migrations.schema_migrations') as name
      `;
      const history = hasHistory[0]?.name
        ? await transaction<{ version: string }[]>`
            select version from supabase_migrations.schema_migrations
          `
        : [];
      const applied = new Set(history.map((row) => row.version));
      const pending = readdirSync(
        new URL("../../supabase/migrations/", import.meta.url),
      )
        .filter((name) => /^\d{14}_.+\.sql$/.test(name))
        .filter((name) => !applied.has(name.slice(0, 14)))
        .sort();

      if (missing.length) {
        console.error(
          "Database is missing columns required by the current code:",
        );
        missing.forEach((name) => console.error(`  ${name}`));
      }
      if (pending.length) {
        console.error("Unapplied database migrations:");
        pending.forEach((name) => console.error(`  ${name}`));
      }
      if (missing.length || pending.length) {
        console.error(
          "Review and apply the pending migrations to this database, then rerun pnpm db:check. No database changes were made.",
        );
        process.exitCode = 1;
      } else {
        console.log(
          "Database columns and migration history match the current code.",
        );
      }
    });
  } catch {
    // Avoid printing a credential-bearing connection URL or driver details.
    console.error(
      "Database check failed. Verify DATABASE_URL, connectivity, and catalog-read permissions. No database changes were made.",
    );
    process.exitCode = 1;
  } finally {
    try {
      await client?.end();
    } catch {
      console.error("Database connection cleanup failed.");
      process.exitCode = 1;
    }
  }
}

await checkDatabase();
