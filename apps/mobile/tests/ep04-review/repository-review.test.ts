import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalSqliteConnection } from "../../src/storage/v2/connection";
import { LedgerRepository } from "../../src/storage/v2/repository";
import type { FaultPoint } from "../../src/storage/v2/types";
import { IndependentSqlite } from "./sqlite-driver";
import { at, fixture, hash, id } from "./fixture";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "miniros-ep04-ledger-review-")),
    path = join(directory, "ledger.sqlite");
  cleanup.push(async () => rmSync(directory, { recursive: true, force: true }));
  const f = await fixture();
  let failAt: FaultPoint | null = null;
  async function connect() {
    const raw = new IndependentSqlite(path),
      connection = await LocalSqliteConnection.open(raw);
    const repo = new LedgerRepository(connection, {
      authority: f.authority,
      hash,
      now: () => at,
      fault: (point) => {
        if (point === failAt) throw new Error(`injected ${point}`);
      },
    });
    cleanup.push(() => repo.close());
    await repo.initialize();
    return { repo, raw };
  }
  const first = await connect();
  await first.repo.storeSnapshot(f.snapshot);
  await first.repo.commit(f.opening);
  await first.repo.saveDraft(f.scope, f.draft, null);
  return {
    ...f,
    ...first,
    connect,
    fail: (point: FaultPoint | null) => {
      failAt = point;
    },
  };
}

describe("EP04 independent complete journal transaction review", () => {
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
    "EP04-T01/T02 rolls back every record at %s and permits exact retry after reopen",
    async (point) => {
      const h = await setup();
      h.fail(point);
      const options = {
        draft: { draftId: h.draft.id, revision: 1 },
        attachments: [
          {
            attachmentId: id(14),
            localUri: "file:///retained/private-proof.jpg",
            mediaDigest: "a".repeat(64),
          },
        ],
      };
      await expect(h.repo.commit(h.sale, options)).rejects.toThrow(
        `injected ${point}`,
      );
      h.fail(null);
      await h.repo.close();
      const reopened = await h.connect();
      const before = await reopened.repo.readiness(h.scope);
      expect(before).toMatchObject({
        operationCount: 1,
        peerPending: 1,
        cloudPending: 1,
        attachmentPending: 0,
      });
      expect(before.projection).toMatchObject({
        lastSequence: 1,
        grossSalesMinor: 0,
        stockAtoms: { [id(5)]: 10 },
      });
      expect(
        (await reopened.repo.readDraft(h.scope, h.draft.id))
          ?.committedOperationId,
      ).toBeNull();
      expect(
        await reopened.raw.all("SELECT * FROM v2_local_tenders"),
      ).toHaveLength(0);
      const saved = await reopened.repo.commit(h.sale, options);
      expect(saved.duplicate).toBe(false);
      expect(saved.projection).toMatchObject({
        lastSequence: 2,
        grossSalesMinor: 500,
        stockAtoms: { [id(5)]: 9 },
      });
      expect(
        (await reopened.repo.readDraft(h.scope, h.draft.id))
          ?.committedOperationId,
      ).toBe(h.sale.operationId);
      expect(await reopened.repo.readiness(h.scope)).toMatchObject({
        operationCount: 2,
        peerPending: 2,
        cloudPending: 2,
        attachmentPending: 1,
      });
    },
  );

  it("EP04-T01 preserves commit when response is lost after COMMIT and returns original receipt on restart/retry", async () => {
    const h = await setup();
    h.fail("after-commit");
    await expect(h.repo.commit(h.sale)).rejects.toThrow(
      "injected after-commit",
    );
    h.fail(null);
    await h.repo.close();
    const reopened = await h.connect();
    const retried = await reopened.repo.commit(h.sale);
    expect(retried).toMatchObject({
      duplicate: true,
      receipt: { savedAt: at, sequence: 2 },
      projection: { grossSalesMinor: 500, stockAtoms: { [id(5)]: 9 } },
    });
    expect(
      await reopened.raw.all("SELECT operation_id FROM v2_local_tenders"),
    ).toHaveLength(1);
  });

  it("EP04-T03 atomic commit and draft compare-and-swap serialize simultaneous independent connections", async () => {
    const h = await setup(),
      second = await h.connect();
    const results = await Promise.all([
      h.repo.commit(h.sale, { draft: { draftId: h.draft.id, revision: 1 } }),
      second.repo.commit(h.sale, {
        draft: { draftId: h.draft.id, revision: 1 },
      }),
    ]);
    expect(results.map((result) => result.duplicate).sort()).toEqual([
      false,
      true,
    ]);
    expect(results[0]!.receipt).toEqual(results[1]!.receipt);
    expect(await h.repo.readiness(h.scope)).toMatchObject({
      operationCount: 2,
      peerPending: 2,
      cloudPending: 2,
    });
    const newer = { ...h.draft, id: id(15), revision: 1 };
    await h.repo.saveDraft(h.scope, newer, null);
    const edits = await Promise.allSettled([
      h.repo.saveDraft(
        h.scope,
        { ...newer, revision: 2, data: { lines: [], text: "first" } },
        1,
      ),
      second.repo.saveDraft(
        h.scope,
        { ...newer, revision: 2, data: { lines: [], text: "second" } },
        1,
      ),
    ]);
    expect(
      edits.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(edits.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
  });

  it("Retains peer and cloud queues independently and requires authenticated matching receipts", async () => {
    const h = await setup();
    await h.repo.commit(h.sale);
    h.setReceiptsAllowed(false);
    await expect(h.repo.recordReceipt(h.receipt(h.sale))).rejects.toThrow(
      "UNAUTHENTICATED_RECEIPT",
    );
    h.setReceiptsAllowed(true);
    await expect(
      h.repo.recordReceipt({
        ...h.receipt(h.sale),
        canonicalDigest: "f".repeat(64),
      }),
    ).rejects.toThrow();
    await h.repo.recordReceipt(h.receipt(h.sale, "peer"));
    expect(
      (await h.repo.pending(h.scope, "peer")).map(
        (row) => row.operation.operationId,
      ),
    ).toEqual([h.opening.operationId]);
    expect(await h.repo.pending(h.scope, "cloud")).toHaveLength(2);
    await h.repo.recordAttempt(
      h.scope,
      h.sale.operationId,
      "cloud",
      "TOKEN_EXPIRED",
    );
    expect((await h.repo.pending(h.scope, "cloud"))[1]).toMatchObject({
      attemptCount: 1,
      lastErrorCode: "TOKEN_EXPIRED",
    });
    await h.repo.recordReceipt(h.receipt(h.sale, "cloud"));
    await h.repo.recordReceipt(h.receipt(h.sale, "cloud"));
    await expect(
      h.repo.recordReceipt({
        ...h.receipt(h.sale),
        receivedAt: "2026-09-08T00:00:00.000Z",
      }),
    ).rejects.toThrow();
    expect(await h.repo.pending(h.scope, "cloud")).toHaveLength(1);
  });

  it.each(["account", "business", "installation", "locked", "signed-out"])(
    "EP04-T06 isolates %s changes without deleting retained records",
    async (change) => {
      const h = await setup();
      await h.repo.commit(h.sale);
      h.setIdentity(
        change === "signed-out"
          ? null
          : {
              accountId: change === "account" ? id(90) : id(9),
              businessId: change === "business" ? id(90) : id(1),
              installationId: change === "installation" ? id(90) : id(8),
              locked: change === "locked",
            },
      );
      for (const read of [
        () => h.repo.readiness(h.scope),
        () => h.repo.readDraft(h.scope, h.draft.id),
        () => h.repo.pending(h.scope, "cloud"),
        () => h.repo.diagnostics(h.scope),
      ])
        await expect(read()).rejects.toThrow();
      h.setIdentity({
        accountId: id(9),
        businessId: id(1),
        installationId: id(8),
        locked: false,
      });
      expect(await h.repo.readiness(h.scope)).toMatchObject({
        operationCount: 2,
        cloudPending: 2,
      });
      expect(await h.repo.diagnostics(h.scope)).not.toMatch(
        /11111111|Review tea|private-proof|signature|operationId|businessId/,
      );
    },
  );

  it("rejects a committed ID with freshly sealed changed payload without changing balances", async () => {
    const h = await setup();
    await h.repo.commit(h.sale);
    if (h.sale.kind !== "SALE") throw new Error("fixture");
    const altered = await h.operation(
      "SALE",
      { ...h.sale.payload, saleId: id(91) },
      2,
      h.sale.operationId,
    );
    await expect(h.repo.commit(altered)).rejects.toThrow("OPERATION_CONFLICT");
    expect((await h.repo.readiness(h.scope)).projection.grossSalesMinor).toBe(
      500,
    );
  });

  it("readiness rejects a corrupted projection even when journal sequence and seen IDs still match", async () => {
    const h = await setup();
    await h.repo.commit(h.sale);
    await h.raw.run(
      "UPDATE v2_local_projections SET projection_json=json_set(projection_json,'$.grossSalesMinor',999999,'$.stockAtoms.\"11111111-1111-4111-8111-000000000005\"',99)",
    );
    await expect(h.repo.readiness(h.scope)).rejects.toThrow();
  });

  it("EP04-T04 count autosave write denial preserves the last committed zero count after reopen", async () => {
    const h = await setup();
    const openingDraft = {
      ...h.draft,
      id: id(32),
      kind: "opening" as const,
      data: {
        counts: [{ itemId: id(5), kind: "counted" as const, atoms: 0 }],
        openingCashMinor: 0,
        uncountedOnly: true,
      },
    };
    await h.repo.saveDraft(h.scope, openingDraft, null);
    await h.raw.exec("PRAGMA query_only=ON");
    await expect(
      h.repo.saveDraft(
        h.scope,
        {
          ...openingDraft,
          revision: 2,
          data: {
            ...openingDraft.data,
            counts: [{ itemId: id(5), kind: "counted", atoms: 8 }],
          },
        },
        1,
      ),
    ).rejects.toThrow(/readonly/i);
    await h.repo.close();
    const reopened = await h.connect();
    expect(
      await reopened.repo.readDraft(h.scope, openingDraft.id),
    ).toMatchObject({
      draft: { revision: 1, data: { counts: [{ kind: "counted", atoms: 0 }] } },
    });
    await reopened.repo.saveDraft(
      h.scope,
      {
        ...openingDraft,
        revision: 2,
        data: { counts: [{ itemId: id(5), kind: "uncounted" }] },
      },
      1,
    );
    expect(
      (await reopened.repo.readDraft(h.scope, openingDraft.id))?.draft.data
        .counts,
    ).toEqual([{ itemId: id(5), kind: "uncounted" }]);
  });

  it("EP04-T06 an account switch during trusted authorization aborts the complete transaction", async () => {
    const h = await setup();
    h.authority.authorizeOperation = async () => {
      h.setIdentity({
        accountId: id(90),
        businessId: id(1),
        installationId: id(8),
        locked: false,
      });
      return h.actor;
    };
    await expect(h.repo.commit(h.sale)).rejects.toThrow("IDENTITY_CHANGED");
    h.setIdentity({
      accountId: id(9),
      businessId: id(1),
      installationId: id(8),
      locked: false,
    });
    h.authority.authorizeOperation = async () => h.actor;
    expect(await h.repo.readiness(h.scope)).toMatchObject({
      operationCount: 1,
      peerPending: 1,
      cloudPending: 1,
    });
  });
});
