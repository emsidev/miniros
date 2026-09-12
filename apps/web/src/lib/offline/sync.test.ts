import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { preparedFixture, opening, sale, uuid } from "@/test/offline-fixture";
// The real sync coordinator runs against a uniquely named in-memory IndexedDB.
const isolated = vi.hoisted(() => ({ name: `ep00-${crypto.randomUUID()}` }));
vi.mock("./store", async (original) => {
  const actual = await original<typeof import("./store")>();
  const db = new actual.ShiftStore(isolated.name);
  return {
    ...actual,
    shiftStore: () => db,
    localInstallationId: () => actual.localInstallationId(db),
    cachedIdentity: () => actual.cachedIdentity(db),
    visibleSessions: () => actual.visibleSessions(db),
  };
});
import {
  shiftStore,
  savePreparedShift,
  appendShiftAction,
  visibleSessions,
} from "./store";
import { synchronizePreparedShifts, synchronizeEvidence } from "./sync";
beforeEach(async () => {
  await shiftStore().open();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await shiftStore().delete();
});
it("EP00-T03 uploads financial sale B despite failed proof A without losing local records", async () => {
  const db = shiftStore();
  const session = preparedFixture();
  const identity = {
    userId: session.snapshot.userId,
    businessId: session.snapshot.businessId,
    deviceId: session.deviceId,
  };
  await db.meta.put({
    id: "storageInstallationId",
    value: session.snapshot.storageInstallationId,
  });
  await savePreparedShift(session, identity, db);
  const openId = uuid(),
    saleAId = uuid(),
    saleBId = uuid(),
    fileId = uuid();
  await appendShiftAction(session.id, opening(session), openId, [], db);
  const a = sale(session);
  if (a.type !== "CREATE_SALE") throw new Error("Wrong fixture");
  const file = new File(["proof"], "proof.pdf", { type: "application/pdf" });
  a.payload.payments[0]!.paymentMethod = "gcash";
  a.payload.payments[0]!.amountCents = 20000;
  a.payload.payments[0]!.referenceNumber = "SYNTHETIC";
  a.proofs = [
    {
      fileId,
      paymentId: a.payload.payments[0]!.id,
      name: file.name,
      size: file.size,
      mimeType: "application/pdf",
    },
  ];
  await appendShiftAction(
    session.id,
    a,
    saleAId,
    [
      {
        id: fileId,
        sessionId: session.id,
        paymentId: a.payload.payments[0]!.id,
        file,
        synced: 0,
      },
    ],
    db,
  );
  await appendShiftAction(session.id, sale(session), saleBId, [], db);
  // Start and A have already received server acknowledgement.
  await db.shiftActions.update(openId, { status: "synced" });
  await db.shiftActions.update(saleAId, { status: "synced" });
  const calls: string[] = [];
  let finishProof!: () => void;
  let markProofStarted!: () => void;
  const proofStarted = new Promise<void>((resolve) => {
    markProofStarted = resolve;
  });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url === "/api/offline/status")
        return Response.json({ ...identity, sessions: [] });
      if (url === "/api/offline/proof")
        return new Promise<Response>((resolve) => {
          finishProof = () =>
            resolve(
              Response.json(
                { error: "Injected proof failure", code: "RETRY" },
                { status: 503 },
              ),
            );
          markProofStarted();
        });
      if (url === "/api/offline/sync")
        return Response.json({
          ok: true,
          sequence: JSON.parse(String(init?.body)).sequence,
          sessionStatus: "active",
          result: {},
        });
      throw new Error("Unexpected request");
    }),
  );
  await synchronizePreparedShifts();
  const evidence = synchronizeEvidence();
  await proofStarted;
  // A third financial action must complete while the first photo is still hung.
  const saleCId = uuid();
  await appendShiftAction(session.id, sale(session), saleCId, [], db);
  await synchronizePreparedShifts();
  expect(await db.shiftActions.get(saleCId)).toMatchObject({
    status: "synced",
  });
  finishProof();
  await evidence;
  expect(calls).toContain("/api/offline/sync");
  expect(await db.shiftActions.get(saleBId)).toMatchObject({
    status: "synced",
  });
  expect(await db.proofs.get(fileId)).toMatchObject({
    synced: 0,
    error: "Injected proof failure",
  });
  expect(await db.sessions.get(session.id)).toMatchObject({
    projection: { saleCount: 3, salesCents: 60000 },
  });
  expect(await db.shiftActions.count()).toBe(4);
});
it("EP00-T04 disposable two-tenant records remain isolated and retained", async () => {
  const db = shiftStore();
  const a = preparedFixture(),
    b = preparedFixture();
  b.snapshot.storageInstallationId = a.snapshot.storageInstallationId;
  await db.meta.put({
    id: "storageInstallationId",
    value: a.snapshot.storageInstallationId,
  });
  for (const session of [a, b])
    await savePreparedShift(
      session,
      {
        userId: session.snapshot.userId,
        businessId: session.snapshot.businessId,
        deviceId: session.deviceId,
      },
      db,
    );
  expect((await visibleSessions()).map((s) => s.id)).toEqual([b.id]);
  expect(await db.sessions.count()).toBe(2);
  expect(await db.sessions.get(a.id)).toBeDefined();
});
