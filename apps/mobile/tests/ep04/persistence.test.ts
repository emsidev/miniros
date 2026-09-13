import { afterEach, describe, expect, it } from "vitest";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalV2, sealV2Operation, type V2Draft } from "@miniros/domain/v2";
import { LocalSqliteConnection } from "../../src/storage/v2/connection";
import { migrateLocalDatabase } from "../../src/storage/v2/migrate";
import { LOCAL_MIGRATIONS } from "../../src/storage/v2/migrations";
import type { FaultPoint, StorageIdentity } from "../../src/storage/v2/types";
import {
  fixtureAuthority,
  fixtureSnapshot,
  hash,
  identity,
  ids,
  line,
  NodeRaw,
  openRepository,
  operations,
  remoteReceipt,
  scope,
  uuid,
} from "./fixtures";
const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});
function pathForTest() {
  const directory = mkdtempSync(join(tmpdir(), "miniros-ep04-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, "ledger.sqlite");
}
async function setup(options: Parameters<typeof openRepository>[1] = {}) {
  const path = pathForTest();
  const opened = await openRepository(path, options);
  cleanup.push(() => opened.repository.close());
  const snapshot = await fixtureSnapshot();
  const inputs = await operations(snapshot);
  await opened.repository.storeSnapshot(snapshot);
  await opened.repository.commit(inputs.opening);
  await opened.repository.saveDraft(scope, inputs.draft, null);
  return { ...opened, path, snapshot, ...inputs };
}
async function receiptCounts(raw: NodeRaw) {
  return Object.fromEntries(
    await Promise.all(
      ["operations", "tenders", "outbox", "receipts"].map(async (table) => [
        table,
        (
          await raw.all<{ n: number }>(
            `SELECT COUNT(*) AS n FROM v2_local_${table}`,
          )
        )[0]?.n,
      ]),
    ),
  );
}

describe("EP04 real SQLite persistence", () => {
  it.each<FaultPoint>([
    "journal",
    "projection",
    "tenders",
    "peer-outbox",
    "cloud-outbox",
    "draft-commit",
    "attachments",
    "local-receipt",
    "before-commit",
  ])(
    "EP04-T02 rolls every sale effect back at %s without clearing its cart",
    async (failure) => {
      let armed = false;
      const h = await setup({
        fault: (point) => {
          if (armed && point === failure)
            throw new Error(`injected-${failure}`);
        },
      });
      armed = true;
      await expect(
        h.repository.commit(h.sale, {
          draft: { draftId: ids.draft, revision: 1 },
          attachments: [
            {
              attachmentId: ids.attachment,
              localUri: "file:///private/synthetic-proof.jpg",
              mediaDigest: "b".repeat(64),
            },
          ],
        }),
      ).rejects.toThrow(`injected-${failure}`);
      armed = false;
      const state = await h.repository.readiness(scope);
      expect(state).toMatchObject({
        ready: true,
        operationCount: 1,
        peerPending: 1,
        cloudPending: 1,
        attachmentPending: 0,
      });
      expect(state.projection.stockAtoms[ids.item]).toBe(1000);
      expect(state.projection.grossSalesMinor).toBe(0);
      expect(
        (await h.repository.readDraft(scope, ids.draft))?.committedOperationId,
      ).toBeNull();
      expect(await receiptCounts(h.raw)).toEqual({
        operations: 1,
        tenders: 0,
        outbox: 2,
        receipts: 0,
      });
    },
  );
  it("does not turn an after-commit response failure into loss; retry returns the original receipt", async () => {
    let armed = false;
    const h = await setup({
      fault: (point) => {
        if (armed && point === "after-commit") throw new Error("response-lost");
      },
    });
    armed = true;
    await expect(
      h.repository.commit(h.sale, {
        draft: { draftId: ids.draft, revision: 1 },
      }),
    ).rejects.toThrow("response-lost");
    armed = false;
    const retry = await h.repository.commit(h.sale);
    expect(retry.duplicate).toBe(true);
    expect(retry.receipt.savedAt).toBe("2026-09-07T12:01:00.000Z");
    expect(retry.projection.stockAtoms[ids.item]).toBe(999);
    expect(
      (await h.repository.readDraft(scope, ids.draft))?.committedOperationId,
    ).toBe(ids.saleOperation);
    expect(await receiptCounts(h.raw)).toEqual({
      operations: 2,
      tenders: 1,
      outbox: 4,
      receipts: 0,
    });
  });
  it.each(["before-commit", "after-commit"])(
    "EP04-T01 survives real process SIGKILL %s and reopens the actual file",
    async (boundary) => {
      const h = await setup();
      await h.repository.close();
      const worker = fork(
        fileURLToPath(new URL("./crash-worker.ts", import.meta.url)),
        [h.path, boundary],
        {
          execArgv: ["--import", "tsx"],
          stdio: ["ignore", "ignore", "pipe", "ipc"],
        },
      );
      let stderr = "";
      worker.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      cleanup.push(() => {
        worker.kill("SIGKILL");
      });
      const message = await Promise.race([
        once(worker, "message"),
        once(worker, "exit").then(() => {
          throw new Error(`Crash worker exited early: ${stderr}`);
        }),
      ]);
      expect(message[0]).toEqual({ boundary });
      worker.kill("SIGKILL");
      await once(worker, "exit");
      const reopened = await openRepository(h.path);
      cleanup.push(() => reopened.repository.close());
      const state = await reopened.repository.readiness(scope);
      const committed = boundary === "after-commit";
      expect(state.operationCount).toBe(committed ? 2 : 1);
      expect(state.projection.stockAtoms[ids.item]).toBe(
        committed ? 999 : 1000,
      );
      expect(state.peerPending).toBe(committed ? 2 : 1);
      expect(state.cloudPending).toBe(committed ? 2 : 1);
      expect(
        (await reopened.repository.readDraft(scope, ids.draft))
          ?.committedOperationId,
      ).toBe(committed ? ids.saleOperation : null);
    },
    15_000,
  );
  it("EP04-T03 serializes real competing connections and commits one sale/tender/outbox pair", async () => {
    const h = await setup();
    const second = await openRepository(h.path);
    cleanup.push(() => second.repository.close());
    const results = await Promise.all([
      h.repository.commit(h.sale, {
        draft: { draftId: ids.draft, revision: 1 },
      }),
      second.repository.commit(h.sale, {
        draft: { draftId: ids.draft, revision: 1 },
      }),
    ]);
    expect(results.map((result) => result.duplicate).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0]?.receipt).toEqual(results[1]?.receipt);
    expect(await receiptCounts(h.raw)).toEqual({
      operations: 2,
      tenders: 1,
      outbox: 4,
      receipts: 0,
    });
    expect(
      (await h.repository.readProjection(scope)).stockAtoms[ids.item],
    ).toBe(999);
  });
  it("lets a second actual SQLite writer wait until a held transaction releases", async () => {
    const h = await setup();
    const second = await openRepository(h.path);
    cleanup.push(() => second.repository.close());
    let release!: () => void;
    let entered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const holding = h.connection.transaction(async () => {
      entered();
      await held;
    });
    await ready;
    let completed = false;
    const writing = second.repository.commit(h.sale).then((result) => {
      completed = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(completed).toBe(false);
    release();
    await holding;
    expect((await writing).duplicate).toBe(false);
  });
  it("EP04-T04 preserves the previous autosave revision under a real SQLite write denial and reopen", async () => {
    const h = await setup();
    await h.raw.exec("PRAGMA query_only=ON");
    const unsaved: V2Draft = {
      ...h.draft,
      revision: 2,
      data: { lines: [], text: "UNSAVED edited text" },
    };
    await expect(h.repository.saveDraft(scope, unsaved, 1)).rejects.toThrow(
      /readonly/i,
    );
    await h.raw.exec("PRAGMA query_only=OFF");
    await h.repository.close();
    const reopened = await openRepository(h.path);
    cleanup.push(() => reopened.repository.close());
    expect(
      (await reopened.repository.readDraft(scope, ids.draft))?.draft,
    ).toEqual(h.draft);
  });
  it("EP04-T04 recovers counted, zero and uncounted drafts after failed autosave and real SIGKILL", async () => {
    const h = await setup();
    const opening: V2Draft = {
      ...h.draft,
      id: uuid(31),
      kind: "opening",
      data: {
        counts: [{ itemId: ids.item, kind: "counted", atoms: 0 }],
        text: "last committed count",
        openingCashMinor: 0,
      },
    };
    const packing: V2Draft = {
      ...h.draft,
      id: uuid(32),
      kind: "packing",
      data: {
        answers: [
          {
            entryId: uuid(16),
            templateVersion: 1,
            kind: "packed",
            actorId: ids.account,
            at: "2026-09-07T12:00:00.000Z",
          },
        ],
        text: "last committed packing",
      },
    };
    await h.repository.saveDraft(scope, opening, null);
    await h.repository.saveDraft(scope, packing, null);
    await h.repository.close();
    const worker = fork(
      fileURLToPath(new URL("./crash-worker.ts", import.meta.url)),
      [h.path, "failed-autosave"],
      {
        execArgv: ["--import", "tsx"],
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      },
    );
    let stderr = "";
    worker.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    cleanup.push(() => {
      worker.kill("SIGKILL");
    });
    const message = await Promise.race([
      once(worker, "message"),
      once(worker, "exit").then(() => {
        throw new Error(`Autosave worker exited early: ${stderr}`);
      }),
    ]);
    expect(message[0]).toEqual({ boundary: "failed-autosave" });
    worker.kill("SIGKILL");
    await once(worker, "exit");
    const reopened = await openRepository(h.path);
    cleanup.push(() => reopened.repository.close());
    expect(
      (await reopened.repository.readDraft(scope, uuid(31)))?.draft,
    ).toEqual(opening);
    expect(
      (await reopened.repository.readDraft(scope, uuid(32)))?.draft,
    ).toEqual(packing);
    const uncounted: V2Draft = {
      ...opening,
      revision: 2,
      data: { counts: [{ itemId: ids.item, kind: "uncounted" }] },
    };
    await reopened.repository.saveDraft(scope, uncounted, 1);
    expect(
      (await reopened.repository.readDraft(scope, uuid(31)))?.draft.data.counts,
    ).toEqual([{ itemId: ids.item, kind: "uncounted" }]);
  }, 15_000);
  it("preserves records when the actual file is opened read-only", async () => {
    const h = await setup();
    await h.repository.close();
    const readonly = await openRepository(h.path, { readOnly: true });
    cleanup.push(() => readonly.repository.close());
    await expect(readonly.repository.commit(h.sale)).rejects.toThrow(
      /readonly/i,
    );
    expect(await readonly.repository.readiness(scope)).toMatchObject({
      operationCount: 1,
      peerPending: 1,
      cloudPending: 1,
    });
  });
  it("rejects real SQLITE_FULL without a partial sale or a cleared draft", async () => {
    const h = await setup();
    const [pages] = await h.raw.all<{ page_count: number }>(
      "PRAGMA page_count",
    );
    await h.raw.exec(`PRAGMA max_page_count=${pages?.page_count}`);
    const { canonicalDigest, authenticity, ...body } = h.sale;
    void canonicalDigest;
    const large = await sealV2Operation(
      {
        ...body,
        kind: "SALE",
        payload: {
          saleId: ids.sale,
          lines: Array.from({ length: 100 }, () => line),
          discountMinor: 0,
          tenders: [{ method: "cash", tenderedMinor: 20_000, changeMinor: 0 }],
        },
      },
      authenticity,
      hash,
    );
    await expect(h.repository.commit(large)).rejects.toThrow(/full/i);
    expect((await h.repository.readiness(scope)).operationCount).toBe(1);
    expect(
      (await h.repository.readDraft(scope, ids.draft))?.committedOperationId,
    ).toBeNull();
  });
  it("EP04-T05 rolls back an interrupted additive migration and preserves v1 pending records", async () => {
    const source = await setup();
    const path = pathForTest();
    const raw = new NodeRaw(path);
    const connection = await LocalSqliteConnection.open(raw);
    cleanup.push(() => connection.close());
    await migrateLocalDatabase(connection, LOCAL_MIGRATIONS.slice(0, 1));
    // Populate the frozen v1 schema with real retained evidence, including both pending destinations.
    for (const table of [
      "scopes",
      "snapshots",
      "projections",
      "operations",
      "drafts",
      "outbox",
    ]) {
      for (const row of await source.raw.all<
        Record<string, string | number | null>
      >(`SELECT * FROM v2_local_${table}`)) {
        await raw.run(
          `INSERT INTO v2_local_${table} (${Object.keys(row).join(",")}) VALUES (${Object.keys(
            row,
          )
            .map(() => "?")
            .join(",")})`,
          Object.values(row),
        );
      }
    }
    await expect(
      migrateLocalDatabase(connection, LOCAL_MIGRATIONS, (point) => {
        if (point === "migration:2:0") throw new Error("migration-interrupted");
      }),
    ).rejects.toThrow("migration-interrupted");
    expect(
      (await raw.all<{ user_version: number }>("PRAGMA user_version"))[0]
        ?.user_version,
    ).toBe(1);
    expect(
      await raw.all(
        "SELECT destination,attempt_count FROM v2_local_outbox ORDER BY destination",
      ),
    ).toEqual([
      { destination: "cloud", attempt_count: 0 },
      { destination: "peer", attempt_count: 0 },
    ]);
    expect(
      await raw.all(
        "SELECT name FROM sqlite_master WHERE name='v2_local_attachments'",
      ),
    ).toEqual([]);
    await migrateLocalDatabase(connection);
    expect(
      (await raw.all<{ user_version: number }>("PRAGMA user_version"))[0]
        ?.user_version,
    ).toBe(2);
    expect(
      await raw.all(
        "SELECT destination,attempt_count FROM v2_local_outbox ORDER BY destination",
      ),
    ).toEqual([
      { destination: "cloud", attempt_count: 0 },
      { destination: "peer", attempt_count: 0 },
    ]);
    await connection.close();
    const migrated = await openRepository(path);
    cleanup.push(() => migrated.repository.close());
    expect(await migrated.repository.readiness(scope)).toMatchObject({
      operationCount: 1,
      peerPending: 1,
      cloudPending: 1,
    });
    expect(
      (await migrated.repository.readDraft(scope, ids.draft))?.draft,
    ).toEqual(source.draft);
  });
  it("EP04-T06 denies foreign/locked reads but restores retained pending evidence after valid unlock", async () => {
    let current: StorageIdentity | null = identity;
    const h = await setup({ authority: fixtureAuthority(() => current) });
    current = { ...identity, accountId: uuid(900) };
    await expect(h.repository.readProjection(scope)).rejects.toThrow(
      "SCOPE_NOT_AVAILABLE",
    );
    current = { ...identity, businessId: uuid(901) };
    await expect(h.repository.pending(scope, "cloud")).rejects.toThrow(
      "SCOPE_NOT_AVAILABLE",
    );
    current = { ...identity, locked: true };
    await expect(h.repository.readDraft(scope, ids.draft)).rejects.toThrow(
      "Unlock",
    );
    current = null;
    await expect(h.repository.diagnostics(scope)).rejects.toThrow("Unlock");
    current = identity;
    expect((await h.repository.readiness(scope)).operationCount).toBe(1);
  });
  it("an online-token outage alone does not erase or lock a prepared local capability", async () => {
    const h = await setup(); // No online-token/expiry property is consulted by this local repository.
    const result = await h.repository.commit(h.sale);
    expect(result.receipt.outcome).toBe("committed");
    expect(await h.repository.pending(scope, "cloud")).toHaveLength(2);
  });
  it("EP04-T07 enables and verifies foreign keys in every separately opened connection", async () => {
    const h = await setup();
    const second = await openRepository(h.path);
    cleanup.push(() => second.repository.close());
    for (const target of [h, second]) {
      expect(
        (
          await target.raw.all<{ foreign_keys: number }>("PRAGMA foreign_keys")
        )[0]?.foreign_keys,
      ).toBe(1);
      expect(
        (await target.raw.all<{ synchronous: number }>("PRAGMA synchronous"))[0]
          ?.synchronous,
      ).toBe(2);
      await expect(
        target.connection.transaction((tx) =>
          tx
            .run(
              "INSERT INTO v2_local_outbox(scope_id,operation_id,destination) VALUES (?,?,?)",
              ["orphan", uuid(99), "cloud"],
            )
            .then(() => undefined),
        ),
      ).rejects.toThrow(/FOREIGN KEY/i);
    }
  });
  it("keeps cloud, peer and media progress independent, and returns identical original remote receipts", async () => {
    const h = await setup();
    await h.repository.commit(h.sale, {
      attachments: [
        {
          attachmentId: ids.attachment,
          localUri: "file:///private/proof.jpg",
          mediaDigest: "c".repeat(64),
        },
      ],
    });
    const receipt = remoteReceipt(h.sale, "peer");
    await h.repository.recordReceipt(receipt);
    expect(await h.repository.recordReceipt(receipt)).toEqual(receipt);
    await h.repository.recordAttempt(
      scope,
      ids.saleOperation,
      "cloud",
      "TOKEN_EXPIRED",
    );
    await h.repository.updateAttachment(
      scope,
      ids.attachment,
      "pending",
      "UPLOAD_FAILED",
    );
    expect(
      (await h.repository.pending(scope, "peer")).map(
        (item) => item.operation.operationId,
      ),
    ).toEqual([ids.open]);
    expect(await h.repository.pending(scope, "cloud")).toHaveLength(2);
    expect(await h.repository.attachments(scope)).toHaveLength(1);
    await h.repository.recordReceipt(remoteReceipt(h.sale, "cloud"));
    expect(await h.repository.attachments(scope)).toHaveLength(1);
    const diagnostics = await h.repository.diagnostics(scope);
    expect(diagnostics.length).toBeLessThan(1024);
    expect(diagnostics).not.toContain("private");
    expect(diagnostics).not.toContain("signature");
    expect(diagnostics).not.toContain(ids.account);
    expect(diagnostics).not.toContain("TOKEN_EXPIRED");
  });
  it("rejects forged receipts, stale draft writes and mismatched draft-clear revisions", async () => {
    const h = await setup();
    await expect(
      h.repository.commit(h.sale, {
        draft: { draftId: ids.draft, revision: 2 },
      }),
    ).rejects.toThrow("DRAFT_REVISION_CONFLICT");
    await h.repository.commit(h.sale);
    await expect(
      h.repository.recordReceipt({
        ...remoteReceipt(h.sale, "cloud"),
        canonicalDigest: "f".repeat(64),
      }),
    ).rejects.toThrow("RECEIPT_MISMATCH");
    await expect(
      h.repository.saveDraft(scope, { ...h.draft, revision: 3 }, 2),
    ).rejects.toThrow("DRAFT_REVISION_CONFLICT");
    await expect(
      h.repository.saveDraft(
        scope,
        { ...h.draft, kind: "opening", revision: 2, data: { counts: [] } },
        1,
      ),
    ).rejects.toThrow("DRAFT_KIND_CONFLICT");
    expect(await h.repository.pending(scope, "cloud")).toHaveLength(2);
  });
  it("actual readback rejects a corrupted cached stock balance rather than reporting readiness", async () => {
    const h = await setup();
    const state = await h.repository.readProjection(scope);
    await h.raw.run("UPDATE v2_local_projections SET projection_json=?", [
      canonicalV2({ ...state, stockAtoms: { [ids.item]: 9999 } }),
    ]);
    await expect(h.repository.readiness(scope)).rejects.toThrow(
      "PROJECTION_READBACK_MISMATCH",
    );
  });
  it("immutable operation/snapshot/receipt evidence resists updates through direct SQL", async () => {
    const h = await setup();
    await h.repository.recordReceipt(remoteReceipt(h.opening, "cloud"));
    for (const table of ["operations", "snapshots", "receipts"])
      await expect(
        h.connection.transaction((tx) =>
          tx.exec(`DELETE FROM v2_local_${table}`),
        ),
      ).rejects.toThrow("IMMUTABLE_EVIDENCE");
  });
});
