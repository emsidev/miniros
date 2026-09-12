import * as SQLite from "expo-sqlite";
import { LocalSqliteConnection } from "./connection";
import type { RawSqliteConnection } from "./types";
/** Expo57 withExclusiveTransactionAsync opens an unconfigured connection; own this one instead. */
export async function openNativeLedgerConnection(): Promise<LocalSqliteConnection> {
  const db = await SQLite.openDatabaseAsync("miniros-v2-ledger.db", {
    useNewConnection: true,
  });
  const raw: RawSqliteConnection = {
    exec: (sql) => db.execAsync(sql),
    async run(sql, parameters = []) {
      const result = await db.runAsync(sql, [...parameters]);
      return { changes: result.changes };
    },
    all: <T>(sql: string, parameters = []) =>
      db.getAllAsync<T>(sql, [...parameters]),
    close: () => db.closeAsync(),
  };
  return LocalSqliteConnection.open(raw);
}
