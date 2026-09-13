import { afterEach, describe, expect, it } from "vitest";
import {
  makeEnvelope,
  MAX_REORDER_WINDOW,
  type PeerScope,
} from "../../src/ep02/protocol";
import { PeerStore } from "../../src/ep02/store";
import { cashier, hash, prep, ReviewSqlite } from "./fixtures";

const databases: ReviewSqlite[] = [];
async function store(scope: PeerScope, now = () => "2026-09-07T00:00:00.000Z") {
  const db = new ReviewSqlite();
  databases.push(db);
  const subject = new PeerStore(db, scope, now);
  await subject.initialize();
  return { db, subject };
}
function envelope(
  sequence = 1,
  text = "independent numbered fixture",
  scope = cashier,
) {
  return makeEnvelope(
    scope,
    { messageId: `independent-${sequence}`, sequence, number: sequence, text },
    hash,
  );
}
afterEach(() => {
  for (const db of databases.splice(0)) db.dispose();
});

describe("EP02 independent real-SQLite durability and authority boundaries", () => {
  it("EP02-T02 loses ACK after commit, reopens both files, and repeats the original receipt without another alert", async () => {
    const sender = await store(cashier);
    const receiver = await store(prep);
    const original = await envelope();
    await sender.subject.enqueue(original);
    const committed = await receiver.subject.accept(original);
    expect(committed.isNew).toBe(true);
    expect((await sender.subject.stats()).pending).toBe(1);
    sender.db.reopen();
    receiver.db.reopen();
    const senderAfter = new PeerStore(sender.db, cashier);
    const receiverAfter = new PeerStore(
      receiver.db,
      prep,
      () => "2030-01-01T01:00:00.000Z",
    );
    await senderAfter.initialize();
    await receiverAfter.initialize();
    const [retry] = await senderAfter.pending();
    const replayed = await receiverAfter.accept(retry!);
    expect(replayed.receipt).toEqual(committed.receipt);
    expect(replayed.isNew).toBe(false);
    await senderAfter.acknowledge(replayed.receipt);
    await senderAfter.acknowledge(replayed.receipt);
    expect(await senderAfter.stats()).toMatchObject({ saved: 1, pending: 0 });
    expect(await receiverAfter.stats()).toMatchObject({
      received: 1,
      contiguous: 1,
    });
  });

  it("EP02-T02 rejects changed payload under the same ID and retains original wire and receipt", async () => {
    const { db, subject } = await store(prep);
    const original = await envelope();
    const first = await subject.accept(original);
    await expect(
      subject.accept(await envelope(1, "changed text")),
    ).rejects.toThrow("id-conflict");
    const rows = await db.all<{ wire: string; receipt: string }>(
      "SELECT wire, receipt FROM ep02_inbox",
    );
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.wire)).toEqual(original);
    expect(JSON.parse(rows[0]!.receipt)).toEqual(first.receipt);
  });

  it("EP02-T04 buffers sequence 3, then 1, then 2 without claiming a false contiguous boundary", async () => {
    const { subject } = await store(prep);
    expect((await subject.accept(await envelope(3))).contiguous).toBe(0);
    expect((await subject.accept(await envelope(1))).contiguous).toBe(1);
    expect((await subject.accept(await envelope(2))).contiguous).toBe(3);
    expect((await subject.accept(await envelope(3))).isNew).toBe(false);
    expect(await subject.stats()).toMatchObject({ received: 3, contiguous: 3 });
  });

  it("EP02-T04 rejects duplicate sequence with another ID and bounds distant future input", async () => {
    const { subject } = await store(prep);
    await subject.accept(await envelope());
    const colliding = await makeEnvelope(
      cashier,
      { messageId: "another-id", sequence: 1, number: 1, text: "other" },
      hash,
    );
    await expect(subject.accept(colliding)).rejects.toThrow(
      "sequence-conflict",
    );
    await expect(
      subject.accept(await envelope(MAX_REORDER_WINDOW + 2)),
    ).rejects.toThrow("reorder-bound");
    expect(await subject.stats()).toMatchObject({ received: 1, contiguous: 1 });
  });

  it("EP02-T02 returns no receipt and retains no inbox row on a real SQLite write-denial error", async () => {
    const { db, subject } = await store(prep);
    db.db.exec("PRAGMA query_only=ON");
    await expect(subject.accept(await envelope())).rejects.toThrow(/readonly/i);
    db.db.exec("PRAGMA query_only=OFF");
    db.reopen();
    expect(await subject.stats()).toMatchObject({ received: 0, contiguous: 0 });
    expect((await subject.accept(await envelope())).isNew).toBe(true);
  });

  it("EP02-T02 rolls back an injected pre-COMMIT failure and only acknowledges after a successful retry", async () => {
    const { db, subject } = await store(prep);
    db.failBeforeCommit = true;
    await expect(subject.accept(await envelope())).rejects.toThrow(
      "injected-before-commit",
    );
    db.failBeforeCommit = false;
    db.reopen();
    expect(await subject.stats()).toMatchObject({ received: 0, contiguous: 0 });
    expect((await subject.accept(await envelope())).isNew).toBe(true);
  });

  it("serializes competing async duplicate receives with one logical alert and one stored operation", async () => {
    const { subject } = await store(prep);
    const original = await envelope();
    const outcomes = await Promise.all(
      Array.from({ length: 20 }, () => subject.accept(original)),
    );
    expect(outcomes.filter((result) => result.isNew)).toHaveLength(1);
    for (const result of outcomes)
      expect(result.receipt).toEqual(outcomes[0]!.receipt);
    expect(await subject.stats()).toMatchObject({ received: 1, contiguous: 1 });
  });

  it("does not allow forged unknown, mismatched-digest, mismatched-sequence receipts to clear the outbox", async () => {
    const sender = await store(cashier);
    const receiver = await store(prep);
    const original = await envelope();
    await sender.subject.enqueue(original);
    const { receipt } = await receiver.subject.accept(original);
    await expect(
      sender.subject.acknowledge({ ...receipt, messageId: "unknown" }),
    ).rejects.toThrow("unknown-receipt");
    await expect(
      sender.subject.acknowledge({ ...receipt, digest: "b".repeat(64) }),
    ).rejects.toThrow("receipt-mismatch");
    await expect(
      sender.subject.acknowledge({ ...receipt, sequence: 2 }),
    ).rejects.toThrow("receipt-mismatch");
    expect((await sender.subject.stats()).pending).toBe(1);
  });

  it.each([
    "businessId",
    "shiftId",
    "snapshotId",
    "snapshotHash",
    "authorityEpoch",
    "pairingId",
    "senderDeviceId",
    "recipientDeviceId",
  ] as const)(
    "rejects direct receipt scope substitution: %s",
    async (field) => {
      const sender = await store(cashier);
      const receiver = await store(prep);
      const original = await envelope();
      await sender.subject.enqueue(original);
      const { receipt } = await receiver.subject.accept(original);
      const forged = {
        ...receipt,
        [field]:
          field === "authorityEpoch"
            ? 2
            : field === "snapshotHash"
              ? "b".repeat(64)
              : "foreign",
      };
      await expect(sender.subject.acknowledge(forged)).rejects.toThrow(
        "wrong-scope",
      );
      expect((await sender.subject.stats()).pending).toBe(1);
    },
  );

  it("rejects a direct wrong-shift receiver call even when callers bypass wire decoding", async () => {
    const { subject } = await store(prep);
    const foreign = await envelope(1, "foreign", {
      ...cashier,
      shiftId: "foreign-shift",
    });
    await expect(subject.accept(foreign)).rejects.toThrow("wrong-scope");
    expect((await subject.stats()).received).toBe(0);
  });

  it("keeps retained pending evidence isolated under a different local scope", async () => {
    const { db, subject } = await store(cashier);
    await subject.enqueue(await envelope());
    const other = new PeerStore(db, { ...cashier, businessId: "business-b" });
    await other.initialize();
    expect(await other.pending()).toEqual([]);
    expect(await other.stats()).toMatchObject({
      saved: 0,
      received: 0,
      pending: 0,
    });
    expect((await subject.pending()).length).toBe(1);
  });
});
