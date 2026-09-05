import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ShiftStore, savePreparedShift, appendShiftAction } from "./store";
import {
  readDeviceSnapshot,
  syncStatus,
  legacyDeviceUrl,
} from "./device-status";
import { preparedFixture, opening, uuid } from "@/test/offline-fixture";

const databases: ShiftStore[] = [];
async function fixture() {
  const session = preparedFixture();
  const db = new ShiftStore(uuid());
  databases.push(db);
  await db.meta.put({
    id: "storageInstallationId",
    value: session.snapshot.storageInstallationId,
  });
  await savePreparedShift(
    session,
    {
      userId: session.snapshot.userId,
      businessId: session.snapshot.businessId,
      deviceId: session.deviceId,
    },
    db,
  );
  return { db, session };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

describe("device sync presentation", () => {
  it("does not equate connectivity or unused preparation with synced work", async () => {
    expect(syncStatus({ shifts: [], locked: false }, true).state).toBe("empty");
    const { db } = await fixture();
    expect(syncStatus(await readDeviceSnapshot(db), true).label).toBe(
      "Saved on device",
    );
    expect(syncStatus(await readDeviceSnapshot(db), false).label).toBe(
      "Offline",
    );
  });
  it("shows pending changes until the server acknowledges them", async () => {
    const { db, session } = await fixture();
    await appendShiftAction(session.id, opening(session), uuid(), [], db);
    expect(syncStatus(await readDeviceSnapshot(db), true).label).toBe(
      "1 change pending",
    );
    await db.sessions.update(session.id, {
      acknowledgedSequence: 1,
      lastSyncAt: new Date().toISOString(),
    });
    expect(syncStatus(await readDeviceSnapshot(db), true).label).toBe(
      "Up to date",
    );
  });
  it("keeps acknowledged sales with outstanding payment proofs pending", async () => {
    const { db, session } = await fixture();
    await db.sessions.update(session.id, {
      nextSequence: 2,
      acknowledgedSequence: 1,
    });
    await db.proofs.add({
      id: uuid(),
      sessionId: session.id,
      paymentId: uuid(),
      file: new File(["proof"], "proof.txt"),
      synced: 0,
    });
    const snapshot = await readDeviceSnapshot(db);
    expect(snapshot.shifts[0]?.pendingChanges).toBe(0);
    expect(syncStatus(snapshot, true).label).toBe("1 proof pending");
    await db.proofs.toCollection().modify({ error: "Upload failed" });
    expect(syncStatus(await readDeviceSnapshot(db), true).state).toBe(
      "attention",
    );
  });
  it("aggregates multiple visible shifts without counting another account's proofs", async () => {
    const { db, session } = await fixture();
    const first = (await db.sessions.get(session.id))!;
    await db.sessions.update(first.id, { nextSequence: 3 });
    await db.sessions.add({ ...first, id: uuid(), nextSequence: 2 });
    const otherId = uuid();
    await db.sessions.add({
      ...first,
      id: otherId,
      nextSequence: 99,
      snapshot: { ...first.snapshot, userId: uuid() },
    });
    await db.proofs.add({
      id: uuid(),
      sessionId: otherId,
      paymentId: uuid(),
      file: new File(["private"], "private.txt"),
      synced: 0,
    });
    const snapshot = await readDeviceSnapshot(db);
    expect(snapshot.shifts).toHaveLength(2);
    expect(snapshot.shifts.every((row) => !row.pendingProofs)).toBe(true);
    expect(syncStatus(snapshot, true).label).toBe("3 changes pending");
  });
  it("hides all shift details after access expires", async () => {
    const { db } = await fixture();
    await db.meta.delete("identity");
    const snapshot = await readDeviceSnapshot(db);
    expect(snapshot).toEqual({ shifts: [], locked: true });
    expect(syncStatus(snapshot, true).label).toBe("Needs attention");
  });
  it("does not leak another business or device into the panel", async () => {
    const { db, session } = await fixture();
    const identity = {
      userId: session.snapshot.userId,
      businessId: session.snapshot.businessId,
      deviceId: session.deviceId,
    };
    for (const other of [
      { ...identity, businessId: uuid() },
      { ...identity, deviceId: uuid() },
    ]) {
      await db.meta.put({ id: "identity", value: other });
      expect((await readDeviceSnapshot(db)).shifts).toEqual([]);
    }
  });
  it.each(["AUTH", "CONFLICT", "RETRY"])(
    "keeps %s failures actionable",
    async (code) => {
      const { db, session } = await fixture();
      await db.sessions.update(session.id, {
        syncCode: code,
        syncError: "Work needs attention",
      });
      expect(syncStatus(await readDeviceSnapshot(db), true).state).toBe(
        "attention",
      );
    },
  );
  it("distinguishes active sync, pending closeout, owner recovery, and confirmed closure", async () => {
    const { db, session } = await fixture();
    await db.sessions.update(session.id, { syncCode: "SYNCING" });
    expect(syncStatus(await readDeviceSnapshot(db), true).label).toBe(
      "Syncing…",
    );
    const saved = (await db.sessions.get(session.id))!;
    await db.sessions.update(session.id, {
      syncCode: undefined,
      status: "closing",
      projection: { ...saved.projection, state: "closing" },
      nextSequence: 4,
      acknowledgedSequence: 3,
    });
    expect(syncStatus(await readDeviceSnapshot(db), true).state).toBe(
      "attention",
    );
    await db.sessions.update(session.id, { status: "recovery" });
    expect(syncStatus(await readDeviceSnapshot(db), true).state).toBe(
      "attention",
    );
    await db.sessions.update(session.id, { status: "closed" });
    expect(syncStatus(await readDeviceSnapshot(db), true).label).toBe(
      "Up to date",
    );
    expect(
      syncStatus(await readDeviceSnapshot(db), true, "Server unavailable")
        .state,
    ).toBe("attention");
  });
  it("preserves a session in legacy panel links without allowing URL injection", () => {
    const url = new URL(
      legacyDeviceUrl("sync", "test&panel=install"),
      "https://example.test",
    );
    expect(url.pathname).toBe("/offline");
    expect(url.searchParams.get("panel")).toBe("sync");
    expect(url.searchParams.get("session")).toBe("test&panel=install");
  });
});
