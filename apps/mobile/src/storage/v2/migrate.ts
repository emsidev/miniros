import { LocalSqliteConnection } from "./connection";
import { LOCAL_MIGRATIONS } from "./migrations";
import { PersistenceError, type FaultHook, type LocalMigration } from "./types";
/** All missing additive versions and user_version commit together; never delete/reset on failure. */
export async function migrateLocalDatabase(
  connection: LocalSqliteConnection,
  migrations: readonly LocalMigration[] = LOCAL_MIGRATIONS,
  fault?: FaultHook,
): Promise<void> {
  if (migrations.some((migration, index) => migration.version !== index + 1))
    throw new PersistenceError("MIGRATION_ORDER");
  await connection.transaction(async (tx) => {
    const [version] = await tx.all<{ user_version: number }>(
      "PRAGMA user_version",
    );
    const current = version?.user_version ?? 0;
    if (current > migrations.length)
      throw new PersistenceError(
        "NEWER_DATABASE",
        "This database needs a newer app. Retained records were not modified.",
      );
    for (const migration of migrations) {
      if (migration.version <= current) continue;
      for (const [index, statement] of migration.statements.entries()) {
        await tx.exec(statement);
        await fault?.(`migration:${migration.version}:${index}`);
      }
      await tx.exec(`PRAGMA user_version = ${migration.version}`);
    }
  });
}
