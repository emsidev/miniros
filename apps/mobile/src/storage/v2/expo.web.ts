import type { LocalSqliteConnection } from "./connection";
export async function openNativeLedgerConnection(): Promise<LocalSqliteConnection> {
  throw new Error(
    "The v2 financial ledger requires an installed native build. Browser storage is not a native durability substitute.",
  );
}
