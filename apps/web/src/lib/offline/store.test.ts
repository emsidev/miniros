import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  ShiftStore,
  appendShiftAction,
  savePreparedShift,
  visibleSessions,
} from "./store";
import {
  preparedFixture,
  opening,
  sale,
  closeout,
  uuid,
} from "@/test/offline-fixture";
import { offlineOperationSchema } from "@miniros/contracts";
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
  return { session, db };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
describe("durable prepared shifts", () => {
  it("rejects case aliases shared by payment and promo proof declarations", () => {
    const session = preparedFixture();
    const operation = sale(session);
    if (operation.type !== "CREATE_SALE") throw new Error();
    const payment = operation.payload.payments[0]!;
    payment.paymentMethod = "gcash";
    const fileId = `a${uuid().slice(1)}`;
    operation.payload.discount = { promoId: uuid(), proofFileId: fileId };
    operation.discountProof = {
      fileId,
      name: "photo.jpg",
      mimeType: "image/jpeg",
      size: 20,
    };
    operation.proofs = [
      {
        fileId: fileId.toUpperCase(),
        paymentId: payment.id,
        name: "proof.jpg",
        mimeType: "image/jpeg",
        size: 20,
      },
    ];
    expect(() => offlineOperationSchema.parse(operation)).toThrow(
      /matching discount photo/,
    );
  });

  it("persists a manual discount when saved promos are disabled", async () => {
    const { session, db } = await fixture();
    session.snapshot.features.promosEnabled = false;
    await db.sessions.update(session.id, { snapshot: session.snapshot });
    await appendShiftAction(session.id, opening(session), uuid(), [], db);
    const discounted = sale(session);
    if (discounted.type !== "CREATE_SALE") throw new Error();
    discounted.payload.items[0]!.discountCents = 1000;
    await appendShiftAction(session.id, discounted, uuid(), [], db);
    db.close();
    await db.open();
    expect((await db.sessions.get(session.id))?.projection).toMatchObject({
      salesCents: 19000,
      cashCents: 19000,
      saleCount: 1,
      balances: { [session.snapshot.inventory[0]!.id]: "8" },
    });
  });

  it("survives cold reopen with exact ordered actions and seals closeout", async () => {
    const { session, db } = await fixture();
    await appendShiftAction(session.id, opening(session), uuid(), [], db);
    await appendShiftAction(session.id, sale(session), uuid(), [], db);
    await appendShiftAction(session.id, closeout(session), uuid(), [], db);
    db.close();
    await db.open();
    const [saved] = await visibleSessions(db);
    expect(saved?.projection).toMatchObject({
      state: "closing",
      saleCount: 1,
      salesCents: 20000,
      cashCents: 20000,
      productCostCents: 6000,
      balances: { [session.snapshot.inventory[0]!.id]: "8" },
    });
    expect(
      (await db.shiftActions.toArray()).map((a) => a.sequence).sort(),
    ).toEqual([1, 2, 3]);
    await expect(
      appendShiftAction(session.id, sale(session), uuid(), [], db),
    ).rejects.toThrow("closeout");
  });
  it("serializes competing tabs and deduplicates identical double taps", async () => {
    const { session, db } = await fixture();
    const second = new ShiftStore(db.name);
    databases.push(second);
    await appendShiftAction(session.id, opening(session), uuid(), [], db);
    const op = sale(session);
    const id = uuid();
    await Promise.all([
      appendShiftAction(session.id, op, id, [], db),
      appendShiftAction(session.id, op, id, [], second),
    ]);
    expect((await db.sessions.get(session.id))?.projection.saleCount).toBe(1);
    await expect(
      appendShiftAction(session.id, sale(session, 1), id, [], db),
    ).rejects.toThrow("different work");
    second.close();
    databases.pop();
  });
  it("rolls back all local effects if proof storage fails", async () => {
    const { session, db } = await fixture();
    await appendShiftAction(session.id, opening(session), uuid(), [], db);
    const op = sale(session);
    if (op.type !== "CREATE_SALE") throw new Error();
    op.payload.payments[0]!.paymentMethod = "gcash";
    op.payload.payments[0]!.amountCents = 20000;
    op.payload.payments[0]!.referenceNumber = "TEST";
    const file = new File(["%PDF-test"], "proof.pdf", {
      type: "application/pdf",
    });
    const id = uuid();
    op.proofs = [
      {
        fileId: id,
        paymentId: op.payload.payments[0]!.id,
        name: file.name,
        size: file.size,
        mimeType: "application/pdf",
      },
    ];
    db.proofs.hook("creating", () => {
      throw new Error("QuotaExceededError");
    });
    await expect(
      appendShiftAction(
        session.id,
        op,
        uuid(),
        [
          {
            id,
            sessionId: session.id,
            paymentId: op.payload.payments[0]!.id,
            file,
            synced: 0,
          },
        ],
        db,
      ),
    ).rejects.toThrow("QuotaExceededError");
    expect(await db.shiftActions.count()).toBe(1);
    expect((await db.sessions.get(session.id))?.nextSequence).toBe(2);
  });
  it("isolates accounts and preserves locked records", async () => {
    const { session, db } = await fixture();
    await db.meta.delete("identity");
    expect(await visibleSessions(db)).toEqual([]);
    expect(await db.sessions.count()).toBe(1);
    await expect(
      appendShiftAction(session.id, opening(session), uuid(), [], db),
    ).rejects.toThrow("Open the prepared");
    await db.meta.put({
      id: "identity",
      value: {
        userId: uuid(),
        businessId: session.snapshot.businessId,
        deviceId: session.deviceId,
      },
    });
    expect(await visibleSessions(db)).toEqual([]);
  });
  it("does not make requested positive inventory sellable", async () => {
    const { session, db } = await fixture();
    await appendShiftAction(session.id, opening(session), uuid(), [], db);
    const request = offlineOperationSchema.parse({
      type: "CREATE_INVENTORY_ADJUSTMENT",
      payload: {
        adjustmentId: uuid(),
        inventoryEventId: uuid(),
        shiftId: session.snapshot.shiftId,
        inventoryItemId: session.snapshot.inventory[0]!.id,
        quantityDelta: 20,
        reason: "Awaiting review",
      },
    });
    await appendShiftAction(session.id, request, uuid(), [], db);
    await expect(
      appendShiftAction(session.id, sale(session, 11), uuid(), [], db),
    ).rejects.toThrow("Insufficient stock");
    expect(await db.shiftActions.count()).toBe(2);
  });
  it("retains proof bytes together with the sale across reopening", async () => {
    const { session, db } = await fixture();
    await appendShiftAction(session.id, opening(session), uuid(), [], db);
    const op = sale(session);
    if (op.type !== "CREATE_SALE") throw new Error();
    const payment = op.payload.payments[0]!;
    payment.paymentMethod = "gcash";
    payment.amountCents = 20000;
    payment.referenceNumber = "TEST";
    const file = new File(["%PDF-preserved"], "proof.pdf", {
      type: "application/pdf",
    });
    const id = uuid();
    op.proofs = [
      {
        fileId: id,
        paymentId: payment.id,
        name: file.name,
        size: file.size,
        mimeType: "application/pdf",
      },
    ];
    await appendShiftAction(
      session.id,
      op,
      uuid(),
      [{ id, sessionId: session.id, paymentId: payment.id, file, synced: 0 }],
      db,
    );
    db.close();
    await db.open();
    expect(await (await db.proofs.get(id))?.file.text()).toBe("%PDF-preserved");
    expect((await db.sessions.get(session.id))?.projection.saleCount).toBe(1);
  });
});
