import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalSqliteConnection } from "../../src/storage/v2/connection";
import { migrateLocalDatabase } from "../../src/storage/v2/migrate";
import { LOCAL_MIGRATIONS } from "../../src/storage/v2/migrations";
import { IndependentSqlite } from "./sqlite-driver";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "miniros-ep04-review-"));
  const path = join(directory, "ledger.sqlite");
  cleanup.push(async () => {
    rmSync(directory, { recursive: true, force: true });
  });
  async function connect() {
    const raw = new IndependentSqlite(path);
    const connection = await LocalSqliteConnection.open(raw);
    cleanup.push(() => connection.close());
    return { raw, connection };
  }
  return { path, connect, ...(await connect()) };
}
async function seedPending(raw: IndependentSqlite) {
  await raw.run(
    "INSERT INTO v2_local_scopes(scope_id,account_id,business_id,installation_id,shift_id,authority_epoch,snapshot_id,snapshot_hash) VALUES ('review-scope','account-a','business-a','device-a','shift-a',1,'snapshot-a',?)",
    ["a".repeat(64)],
  );
  await raw.run(
    "INSERT INTO v2_local_operations(scope_id,operation_id,sequence,canonical_digest,operation_json,local_receipt_json,saved_at) VALUES ('review-scope','retained-operation',1,?,'{}','{}','2026-09-07T00:00:00.000Z')",
    ["b".repeat(64)],
  );
  await raw.run(
    "INSERT INTO v2_local_outbox(scope_id,operation_id,destination) VALUES ('review-scope','retained-operation','cloud')",
  );
}

describe("EP04 independent SQLite engine, connection and migration review", () => {
  it("EP04-T07 configures FK/WAL/FULL on every independent connection and enforces orphan protection in raw/transaction/read helpers", async () => {
    const h = await setup();
    await migrateLocalDatabase(h.connection);
    const second = await h.connect();
    for (const endpoint of [h, second]) {
      expect(await endpoint.raw.all("PRAGMA foreign_keys")).toEqual([
        { foreign_keys: 1 },
      ]);
      expect(await endpoint.raw.all("PRAGMA synchronous")).toEqual([
        { synchronous: 2 },
      ]);
      expect(await endpoint.raw.all("PRAGMA journal_mode")).toEqual([
        { journal_mode: "wal" },
      ]);
      const orphan =
        "INSERT INTO v2_local_outbox(scope_id,operation_id,destination) VALUES ('absent','absent','cloud')";
      await expect(endpoint.raw.run(orphan)).rejects.toThrow(/FOREIGN KEY/);
      await expect(
        endpoint.connection.transaction((tx) => tx.run(orphan)),
      ).rejects.toThrow(/FOREIGN KEY/);
      await expect(
        endpoint.connection.read((tx) => tx.run(orphan)),
      ).rejects.toThrow(/FOREIGN KEY/);
    }
  });

  it("EP04-T05 migrates a version1 fixture without losing retained immutable pending evidence", async () => {
    const h = await setup();
    await migrateLocalDatabase(h.connection, [LOCAL_MIGRATIONS[0]!]);
    await seedPending(h.raw);
    await migrateLocalDatabase(h.connection);
    expect(await h.raw.all("PRAGMA user_version")).toEqual([
      { user_version: 2 },
    ]);
    expect(
      await h.raw.all("SELECT operation_id,destination FROM v2_local_outbox"),
    ).toEqual([{ operation_id: "retained-operation", destination: "cloud" }]);
    await expect(h.raw.run("DELETE FROM v2_local_operations")).rejects.toThrow(
      "IMMUTABLE_EVIDENCE",
    );
    await expect(
      h.raw.run("UPDATE v2_local_operations SET canonical_digest=?", [
        "c".repeat(64),
      ]),
    ).rejects.toThrow("IMMUTABLE_EVIDENCE");
  });

  it("EP04-T05 rolls back interrupted migration DDL/user_version and preserves the old pending row on reopen", async () => {
    const h = await setup();
    await migrateLocalDatabase(h.connection, [LOCAL_MIGRATIONS[0]!]);
    await seedPending(h.raw);
    await expect(
      migrateLocalDatabase(h.connection, LOCAL_MIGRATIONS, (point) => {
        if (point === "migration:2:0")
          throw new Error("independent migration interruption");
      }),
    ).rejects.toThrow("independent migration interruption");
    await h.connection.close();
    const reopened = await h.connect();
    expect(await reopened.raw.all("PRAGMA user_version")).toEqual([
      { user_version: 1 },
    ]);
    expect(
      await reopened.raw.all(
        "SELECT name FROM sqlite_master WHERE name='v2_local_attachments'",
      ),
    ).toEqual([]);
    expect(
      await reopened.raw.all("SELECT operation_id FROM v2_local_outbox"),
    ).toEqual([{ operation_id: "retained-operation" }]);
    await migrateLocalDatabase(reopened.connection);
    expect(await reopened.raw.all("PRAGMA user_version")).toEqual([
      { user_version: 2 },
    ]);
  });

  it("EP04-T05 refuses a newer file schema without resetting or deleting retained rows", async () => {
    const h = await setup();
    await migrateLocalDatabase(h.connection);
    await seedPending(h.raw);
    await h.raw.exec("PRAGMA user_version=99");
    await expect(migrateLocalDatabase(h.connection)).rejects.toThrow(
      /newer app/,
    );
    expect(await h.raw.all("PRAGMA user_version")).toEqual([
      { user_version: 99 },
    ]);
    expect(
      await h.raw.all("SELECT operation_id FROM v2_local_outbox"),
    ).toHaveLength(1);
  });

  it("serializes two real connections while allowing the coordinator to release the first write lock", async () => {
    const h = await setup();
    const second = await h.connect();
    await h.raw.exec(
      "CREATE TABLE review_serialized(id INTEGER PRIMARY KEY, amount INTEGER NOT NULL)",
    );
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked!: () => void;
    const acquired = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const first = h.connection.transaction(async (tx) => {
      await tx.run("INSERT INTO review_serialized VALUES(1,40)");
      locked();
      await hold;
    });
    await acquired;
    const competing = second.connection.transaction((tx) =>
      tx.run("INSERT INTO review_serialized VALUES(2,2)"),
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    release();
    await Promise.all([first, competing]);
    expect(
      await h.raw.all("SELECT SUM(amount) AS total FROM review_serialized"),
    ).toEqual([{ total: 42 }]);
  });
});
