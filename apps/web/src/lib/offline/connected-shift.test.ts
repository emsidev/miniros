import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  emptyShiftProjection,
  offlineEnvelopeSchema,
} from "@miniros/contracts";
import { preparedFixture, sale, uuid } from "@/test/offline-fixture";
import { ShiftStore, appendShiftAction, savePreparedShift } from "./store";
import {
  loadOpeningDraft,
  saveOpeningDraft,
  submitPreparedOpening,
} from "./opening-draft";
import {
  loadClosingDraft,
  saveClosingDraft,
  submitPreparedClosing,
} from "./count-draft";
import {
  loadRequestDraft,
  saveRequestDraft,
  submitRequestDraft,
} from "./request-draft";

const stores: ShiftStore[] = [];
async function fixture() {
  const prepared = preparedFixture();
  prepared.snapshot.schemaVersion = 2;
  prepared.snapshot.features.recipesEnabled = false;
  prepared.snapshot.features.approvalsEnabled = false;
  prepared.snapshot.products[0]!.stockInventoryItemId =
    prepared.snapshot.inventory[0]!.id;
  prepared.snapshot.products[0]!.costCents = 4000;
  prepared.snapshot.costs = {
    rentCents: 10000,
    transportCents: 2000,
    salaryCents: 5000,
    otherCents: 0,
  };
  const db = new ShiftStore(uuid());
  stores.push(db);
  await db.meta.put({
    id: "storageInstallationId",
    value: prepared.snapshot.storageInstallationId,
  });
  await savePreparedShift(
    prepared,
    {
      userId: prepared.snapshot.userId,
      businessId: prepared.snapshot.businessId,
      deviceId: prepared.deviceId,
    },
    db,
  );
  return { db, session: (await db.sessions.get(prepared.id))! };
}
afterEach(async () => {
  for (const db of stores.splice(0)) await db.delete();
});
describe("connected PWA shift", () => {
  it("recovers stable drafts and completes the stock/cash/profit fixture with direct stock and no Production", async () => {
    const { db, session } = await fixture(),
      item = session.snapshot.inventory[0]!.id;
    const open = {
      ...(await loadOpeningDraft(session.id, db)),
      counts: { [item]: "10" },
      cash: "500",
      step: 2,
    };
    await saveOpeningDraft(session.id, open, db);
    db.close();
    await db.open();
    expect(await loadOpeningDraft(session.id, db)).toEqual(open);
    await submitPreparedOpening(session, open, db);
    let current = (await db.sessions.get(session.id))!;
    const closing = {
      ...(await loadClosingDraft(session.id, db)),
      counts: { [item]: "6" },
      cash: "770",
      step: 1,
    };
    await saveClosingDraft(session.id, closing, db);
    for (const [quantity, method] of [
      [3, "cash"],
      [1, "gcash"],
    ] as const) {
      const operation = sale(session, quantity);
      if (operation.type !== "CREATE_SALE") throw new Error();
      operation.payload.payments[0]!.paymentMethod = method;
      operation.payload.payments[0]!.amountCents = quantity * 10000;
      operation.payload.payments[0]!.referenceNumber =
        method === "gcash" ? "FIXTURE" : null;
      await appendShiftAction(
        session.id,
        operation,
        operation.payload.saleId,
        [],
        db,
      );
    }
    const expense = {
      ...(await loadRequestDraft(session.id, "cash", db)),
      label: "Cash expense",
      amount: "30",
      reason: "Fixture",
    };
    await saveRequestDraft(session.id, "cash", expense, db);
    db.close();
    await db.open();
    expect(await loadRequestDraft(session.id, "cash", db)).toEqual(expense);
    await submitRequestDraft(
      session.id,
      session.snapshot.shiftId,
      "cash",
      expense,
      db,
    );
    current = (await db.sessions.get(session.id))!;
    expect(current.projection).toMatchObject({
      state: "active",
      balances: { [item]: "6" },
      openingCashCents: 50000,
      salesCents: 40000,
      cashCents: 30000,
      productCostCents: 16000,
      deductionsCents: 3000,
    });
    expect(
      current.projection.openingCashCents! +
        current.projection.cashCents -
        current.projection.deductionsCents,
    ).toBe(77000);
    expect(
      current.projection.salesCents -
        current.projection.productCostCents -
        10000 -
        2000 -
        5000 -
        current.projection.deductionsCents,
    ).toBe(4000);
    expect(await loadClosingDraft(session.id, db)).toEqual(closing);
    const [a, b] = await Promise.all([
      submitPreparedClosing(current, closing, db),
      submitPreparedClosing(current, closing, db),
    ]);
    expect(a.id).toBe(b.id);
    expect(await db.shiftActions.count()).toBe(5);
    expect((await db.sessions.get(session.id))!.projection.state).toBe(
      "closing",
    );
    expect(
      await db.drafts.get("counts:" + session.id + ":close"),
    ).toBeUndefined();
  });
  it("blocks blank actual counts and blank float, accepts explicit zero, and retains editable drafts after quota failure", async () => {
    const { db, session } = await fixture(),
      item = session.snapshot.inventory[0]!.id;
    const blank = await loadOpeningDraft(session.id, db);
    expect(blank.counts).toEqual({});
    await expect(submitPreparedOpening(session, blank, db)).rejects.toThrow();
    const open = { ...blank, counts: { [item]: "0" }, cash: "0" };
    await submitPreparedOpening(session, open, db);
    const current = (await db.sessions.get(session.id))!;
    const close = await loadClosingDraft(session.id, db);
    await expect(submitPreparedClosing(current, close, db)).rejects.toThrow(
      "Count every",
    );
    const entered = { ...close, counts: { [item]: "0" }, cash: "0", step: 2 };
    await saveClosingDraft(session.id, entered, db);
    const quota = () => {
      throw new Error("Quota exceeded");
    };
    db.shiftActions.hook("creating", quota);
    await expect(submitPreparedClosing(current, entered, db)).rejects.toThrow(
      "Quota",
    );
    expect(await loadClosingDraft(session.id, db)).toEqual(entered);
    expect((await db.sessions.get(session.id))!.projection.state).toBe(
      "active",
    );
    db.shiftActions.hook("creating").unsubscribe(quota);
    await submitPreparedClosing(current, entered, db);
  });
  it("preserves original v1 envelope IDs, sequence and exact payload shape", () => {
    const prepared = preparedFixture();
    const original = {
      schemaVersion: 1,
      id: uuid(),
      sessionId: prepared.id,
      snapshotId: prepared.snapshot.id,
      sequence: 1,
      occurredAt: "2026-09-05T00:00:00.000Z",
      operation: {
        type: "START_SHIFT",
        payload: {
          shiftId: prepared.snapshot.shiftId,
          inventoryLocationId: prepared.snapshot.inventoryLocationId,
          openingEventId: uuid(),
          counts: [
            {
              inventoryItemId: prepared.snapshot.inventory[0]!.id,
              quantity: 10,
            },
          ],
          notes: null,
        },
      },
    };
    expect(offlineEnvelopeSchema.parse(original)).toEqual(original);
    expect(emptyShiftProjection()).not.toHaveProperty("openingCashCents");
    expect(
      offlineEnvelopeSchema.safeParse({ ...original, schemaVersion: 2 })
        .success,
    ).toBe(false);
  });
  it("a failed sale atomically keeps the cart, evidence and projection without a false receipt", async () => {
    const { db, session } = await fixture(),
      item = session.snapshot.inventory[0]!.id;
    await submitPreparedOpening(
      session,
      {
        ...(await loadOpeningDraft(session.id, db)),
        counts: { [item]: "10" },
        cash: "0",
      },
      db,
    );
    const operation = sale(session);
    if (operation.type !== "CREATE_SALE") throw new Error();
    operation.payload.payments[0]!.paymentMethod = "gcash";
    operation.payload.payments[0]!.amountCents = 20000;
    operation.payload.payments[0]!.referenceNumber = "FIXTURE";
    const draft = {
      cart: { [session.snapshot.products[0]!.id]: 2 },
      saleRequestId: operation.payload.saleId,
      frozen: operation.payload,
    };
    await db.drafts.put({ id: "pos:" + session.id, value: draft });
    const quota = () => {
      throw new Error("Quota exceeded");
    };
    db.proofs.hook("creating", quota);
    const file = new File(["evidence"], "proof.pdf", {
        type: "application/pdf",
      }),
      fileId = uuid();
    operation.proofs = [
      {
        fileId,
        paymentId: operation.payload.payments[0]!.id,
        name: file.name,
        mimeType: "application/pdf",
        size: file.size,
      },
    ];
    await expect(
      appendShiftAction(
        session.id,
        operation,
        operation.payload.saleId,
        [
          {
            id: fileId,
            sessionId: session.id,
            paymentId: operation.payload.payments[0]!.id,
            file,
            synced: 0,
          },
        ],
        db,
      ),
    ).rejects.toThrow("Quota");
    expect((await db.drafts.get("pos:" + session.id))?.value).toEqual(draft);
    expect(await db.shiftActions.count()).toBe(1);
    expect((await db.sessions.get(session.id))!.projection.saleCount).toBe(0);
  });
});
