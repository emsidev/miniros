import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ payment: vi.fn(), discount: vi.fn() }));
vi.mock("@/server/actions/operations", () => ({
  uploadPaymentProofAction: mocks.payment,
  uploadDiscountProofAction: mocks.discount,
}));
import { shiftStore } from "./store";
import {
  handOffLegacyEvidence,
  pendingLegacyEvidence,
  retryLegacyEvidence,
} from "./legacy-evidence";
import type {
  SaleReceipt,
  SubmittedPayment,
} from "@/app/(workspace)/pos/pos-types";
const db = shiftStore();
const identity = { userId: "staff", businessId: "booth", deviceId: null };
function fixture(): SaleReceipt {
  const payment: SubmittedPayment = {
    id: "payment-stable",
    proofFileId: "photo-stable",
    method: "gcash",
    amount: "100",
    amountMode: "exact",
    amountCents: 10000,
    reference: "synthetic",
    file: new File(["payment bytes"], "gcash.jpg", { type: "image/jpeg" }),
  };
  return {
    saleId: "sale-stable",
    totalCents: 10000,
    amountPaidCents: 10000,
    changeCents: 0,
    payments: [payment],
    pendingProofs: [payment],
    pendingDiscountProof: true,
    discountPhoto: {
      fileId: "discount-stable",
      file: new File(["discount bytes"], "discount.jpg", {
        type: "image/jpeg",
      }),
    },
  };
}
beforeEach(async () => {
  await db.meta.put({ id: "identity", value: identity });
  vi.stubGlobal("navigator", { onLine: true });
  mocks.payment
    .mockReset()
    .mockResolvedValue({ ok: false, error: "Injected upload failure" });
  mocks.discount.mockReset().mockResolvedValue({ ok: true, data: {} });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.meta.clear();
  await db.drafts.clear();
});
it("saves the receipt and both photos atomically; failed upload never holds the next cart", async () => {
  const key = "pos:booth:staff:shift";
  await db.drafts.put({
    id: key,
    value: { saleRequestId: "operation-stable", cart: { tea: 1 } },
  });
  await handOffLegacyEvidence(fixture(), "shift", key, false);
  expect(mocks.payment).not.toHaveBeenCalled();
  expect((await db.drafts.get(key))?.value).toMatchObject({
    saleRequestId: "operation-stable",
    receipt: {
      saleId: "sale-stable",
      pendingProofs: [],
      pendingDiscountProof: false,
    },
  });
  const rows = await pendingLegacyEvidence();
  expect(rows.map((row) => row.fileId).sort()).toEqual([
    "discount-stable",
    "photo-stable",
  ]);
  expect(
    await rows.find((row) => row.fileId === "photo-stable")!.file.text(),
  ).toBe("payment bytes");
  await db.drafts.put({
    id: key,
    value: { saleRequestId: "next-operation", cart: { tea: 2 } },
  });
  await retryLegacyEvidence();
  expect((await db.drafts.get(key))?.value).toMatchObject({
    saleRequestId: "next-operation",
    cart: { tea: 2 },
  });
  expect(await pendingLegacyEvidence()).toMatchObject([
    { fileId: "photo-stable", error: "Injected upload failure" },
  ]);
});
it("retains evidence for the original identity and never sends it from another account", async () => {
  await handOffLegacyEvidence(
    fixture(),
    "shift",
    "pos:booth:staff:shift",
    false,
  );
  await db.meta.put({
    id: "identity",
    value: { ...identity, businessId: "other" },
  });
  await retryLegacyEvidence();
  expect(mocks.payment).not.toHaveBeenCalled();
  expect(mocks.discount).not.toHaveBeenCalled();
  expect(await pendingLegacyEvidence()).toEqual([]);
  expect(
    await db.drafts.filter((row) => row.id.startsWith("attachment:")).count(),
  ).toBe(2);
});
it("rolls back evidence and receipt transition on a local storage failure", async () => {
  const key = "pos:booth:staff:shift";
  await db.drafts.put({
    id: key,
    value: { saleRequestId: "operation-stable", cart: { tea: 1 } },
  });
  const original = db.drafts.put.bind(db.drafts);
  const fail = vi.spyOn(db.drafts, "put").mockImplementation((...args) => {
    if (args[0].id === key) throw new Error("Injected quota failure");
    return original(...args);
  });
  await expect(
    handOffLegacyEvidence(fixture(), "shift", key, false),
  ).rejects.toThrow("quota");
  fail.mockRestore();
  expect(await pendingLegacyEvidence()).toEqual([]);
  expect((await db.drafts.get(key))?.value).toEqual({
    saleRequestId: "operation-stable",
    cart: { tea: 1 },
  });
});
