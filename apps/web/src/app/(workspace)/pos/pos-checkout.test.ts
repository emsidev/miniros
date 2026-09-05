import { describe, expect, it, vi } from "vitest";
import {
  calculateTenderChangeCents,
  calculateCheckout,
  centsToInput,
  createPaymentDraft,
  preparePayments,
  syncExactTender,
  validateCheckout,
} from "./pos-checkout";
import type { PosProduct } from "./pos-types";
import { posCartReducer } from "./pos-state";

const product: PosProduct = {
  id: "bread",
  name: "Ube Pandesal",
  categoryName: "Breads",
  priceCents: 1500,
  requiresRecipeDeduction: false,
  stockTracked: false,
  availableQuantity: null,
  stockRequirements: [],
};

describe("POS checkout calculations", () => {
  it("calculates cart totals and caps discounts at the subtotal", () => {
    expect(
      calculateCheckout({
        products: [product],
        cart: { bread: 2 },
        discount: "40",
        promoId: "none",
        promos: [],
      }),
    ).toMatchObject({
      subtotalCents: 3000,
      appliedDiscountCents: 3000,
      totalCents: 0,
    });
  });

  it("keeps a single exact tender synchronized until manually overridden", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "payment-id" });
    const exact = createPaymentDraft("cash", 1500);
    expect(exact.amount).toBe("15.00");
    expect(syncExactTender([exact], 3000)[0]?.amount).toBe("30.00");
    expect(
      syncExactTender(
        [{ ...exact, amountMode: "manual", amount: "50" }],
        3000,
      )[0]?.amount,
    ).toBe("50");
    vi.unstubAllGlobals();
  });

  it("requires positive, fully covering, valid tender rows", () => {
    const cash = {
      id: "cash",
      proofFileId: "proof",
      method: "cash" as const,
      amount: "20",
      amountMode: "manual" as const,
      reference: "",
      file: null,
      amountCents: 2000,
    };
    expect(
      validateCheckout({ itemCount: 1, totalCents: 1500, payments: [cash] }),
    ).toBeNull();
    expect(
      validateCheckout({
        itemCount: 1,
        totalCents: 2500,
        payments: [cash],
      }),
    ).toMatch(/do not cover/);
    expect(
      validateCheckout({
        itemCount: 1,
        totalCents: 1500,
        payments: [{ ...cash, method: "gcash", reference: "" }],
      }),
    ).toMatch(/reference number/);
  });

  it("supports split tender and rejects non-cash overpayment", () => {
    const drafts = [
      {
        id: "cash",
        proofFileId: "cash-proof",
        method: "cash" as const,
        amount: "10",
        amountMode: "manual" as const,
        reference: "",
        file: null,
      },
      {
        id: "gcash",
        proofFileId: "gcash-proof",
        method: "gcash" as const,
        amount: "5",
        amountMode: "manual" as const,
        reference: "12345",
        file: null,
      },
    ];
    const payments = preparePayments(drafts);
    expect(
      validateCheckout({ itemCount: 1, totalCents: 1500, payments }),
    ).toBeNull();
    expect(
      validateCheckout({
        itemCount: 1,
        totalCents: 1400,
        payments: [{ ...payments[1]!, amountCents: 1500 }],
      }),
    ).toMatch(/Only cash/);
  });

  it("formats tender inputs as peso values", () => {
    expect(centsToInput(12345)).toBe("123.45");
  });

  it("calculates the change due from the entered tender", () => {
    const cashTender = {
      id: "cash",
      proofFileId: "cash-proof",
      method: "cash" as const,
      amount: "20",
      amountMode: "manual" as const,
      reference: "",
      file: null,
    };

    expect(calculateTenderChangeCents([cashTender], 1500)).toBe(500);
    expect(calculateTenderChangeCents([cashTender], 2500)).toBe(0);
  });

  it("updates, removes, and resets the shared cart state", () => {
    const withProduct = posCartReducer(
      {},
      { type: "set_quantity", productId: "bread", quantity: 2 },
    );
    expect(withProduct).toEqual({ bread: 2 });
    expect(
      posCartReducer(withProduct, {
        type: "set_quantity",
        productId: "bread",
        quantity: 0,
      }),
    ).toEqual({});
    expect(posCartReducer({ bread: 3 }, { type: "reset" })).toEqual({});
  });
});

describe("promo photos", () => {
  const cash = {
    id: "cash",
    proofFileId: "unused",
    method: "cash" as const,
    amount: "20",
    amountMode: "exact" as const,
    reference: "",
    file: null,
    amountCents: 2000,
  };
  it("uses the configured peso discount and requires a photo even for cash", () => {
    const checkout = calculateCheckout({
      products: [product],
      cart: { bread: 2 },
      discount: "99",
      promoId: "pwd",
      promos: [
        {
          id: "pwd",
          name: "PWD Discount",
          discountType: "fixed_amount",
          discountValue: 10,
          requiresPhoto: true,
        },
      ],
    });
    expect(checkout.totalCents).toBe(2000);
    expect(
      validateCheckout({
        itemCount: 1,
        totalCents: checkout.totalCents,
        payments: [cash],
        requiresPhoto: true,
      }),
    ).toMatch(/Attach a photo/);
    expect(
      validateCheckout({
        itemCount: 1,
        totalCents: 2000,
        payments: [cash],
        requiresPhoto: true,
        discountPhoto: new File(["photo"], "id.jpg", { type: "image/jpeg" }),
      }),
    ).toBeNull();
  });
  it("rejects a PDF or oversized promo photo before saving a sale", () => {
    for (const file of [
      new File(["%PDF"], "id.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(3_500_001)], "id.jpg", { type: "image/jpeg" }),
    ]) {
      expect(
        validateCheckout({
          itemCount: 1,
          totalCents: 2000,
          payments: [cash],
          requiresPhoto: true,
          discountPhoto: file,
        }),
      ).toBeTruthy();
    }
  });
  it("validates attached non-cash files without requiring photos for normal promos", () => {
    expect(
      validateCheckout({
        itemCount: 1,
        totalCents: 2000,
        payments: [
          {
            ...cash,
            method: "gcash",
            reference: "REF",
            file: new File(["bad"], "bad.txt", { type: "text/plain" }),
          },
        ],
      }),
    ).toMatch(/Choose a JPEG/);
    expect(
      validateCheckout({ itemCount: 1, totalCents: 2000, payments: [cash] }),
    ).toBeNull();
  });
});
