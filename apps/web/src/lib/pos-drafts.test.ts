import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  guardSavedCheckoutExit,
  loadCheckoutDraft,
  migrateLegacyCheckouts,
  posDraftStore,
} from "./pos-drafts";
import { shiftStore } from "./offline/store";
const db = shiftStore(),
  legacy = posDraftStore();
afterEach(async () => {
  await db.drafts.clear();
  await db.meta.clear();
  await legacy.drafts.clear();
});
describe("legacy checkout import and exit guards", () => {
  it("imports stable IDs and retains originals without resurrection", async () => {
    const original = {
      cart: { tea: 2 },
      saleRequestId: "stable-sale",
      inventoryEventId: "stable-event",
      payments: [{ id: "stable-payment", amount: "500" }],
      orderStep: "payment",
    };
    await legacy.drafts.put({ id: "pos:business:user:shift", value: original });
    expect(
      (await loadCheckoutDraft("session", "business:user", "shift"))?.value,
    ).toEqual(original);
    expect((await legacy.drafts.get("pos:business:user:shift"))?.value).toEqual(
      original,
    );
    await db.drafts.delete("pos:session");
    await migrateLegacyCheckouts();
    expect(await db.drafts.get("pos:session")).toBeUndefined();
  });
  it("never overwrites two conflicting saved carts", async () => {
    await legacy.drafts.put({
      id: "pos:business:user:shift",
      value: { cart: { tea: 1 } },
    });
    await db.drafts.put({
      id: "pos:business:user:shift",
      value: { cart: { tea: 2 } },
    });
    await expect(migrateLegacyCheckouts()).rejects.toThrow("Neither");
    expect((await legacy.drafts.get("pos:business:user:shift"))?.value).toEqual(
      { cart: { tea: 1 } },
    );
    expect((await db.drafts.get("pos:business:user:shift"))?.value).toEqual({
      cart: { tea: 2 },
    });
  });
  it("blocks logout for discount evidence but excludes another identity's attachments", async () => {
    await db.meta.put({
      id: "identity",
      value: { userId: "user", businessId: "business", deviceId: null },
    });
    await db.drafts.put({
      id: "pos:business:user:shift",
      value: { receipt: { pendingDiscountProof: true } },
    });
    await expect(guardSavedCheckoutExit()).rejects.toThrow("Finish");
    await db.drafts.delete("pos:business:user:shift");
    await db.drafts.put({ id: "attachment:other:other:photo", value: {} });
    await expect(guardSavedCheckoutExit()).resolves.toBeUndefined();
    await db.drafts.put({ id: "attachment:business:user:photo", value: {} });
    await expect(guardSavedCheckoutExit()).rejects.toThrow("attachments");
  });
});
