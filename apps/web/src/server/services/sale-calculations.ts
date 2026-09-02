import type { PaymentMethod } from "@miniros/contracts";
import { addCents, assertNonNegativeCents } from "@miniros/domain";

import { AccessError } from "./access";

export type FinalizeSaleInput = {
  saleId: string;
  shiftId: string;
  inventoryEventId: string;
  items: readonly {
    id: string;
    productId: string;
    quantity: number | string;
    discountCents?: number;
  }[];
  payments: readonly {
    id: string;
    paymentMethod: PaymentMethod;
    amountCents: number;
    referenceNumber?: string | null;
  }[];
};

export function calculateSaleTender(
  paymentRows: FinalizeSaleInput["payments"],
  totalCents: number,
) {
  if (paymentRows.length === 0) {
    throw new AccessError("At least one payment is required.");
  }
  if (
    new Set(paymentRows.map((payment) => payment.id)).size !==
    paymentRows.length
  ) {
    throw new AccessError("Each payment ID must be unique.");
  }
  for (const payment of paymentRows) {
    assertNonNegativeCents(payment.amountCents, "payment amount");
    if (payment.amountCents === 0) {
      throw new AccessError("Payment amounts must be positive.");
    }
  }

  const amountPaidCents = addCents(
    ...paymentRows.map((payment) => payment.amountCents),
  );
  if (amountPaidCents < totalCents) {
    throw new AccessError("Payments do not cover the sale total.");
  }
  const changeCents = amountPaidCents - totalCents;
  const cashPaidCents = addCents(
    ...paymentRows
      .filter((payment) => payment.paymentMethod === "cash")
      .map((payment) => payment.amountCents),
  );
  if (changeCents > cashPaidCents) {
    throw new AccessError("Only cash tender can fund change.");
  }
  return { amountPaidCents, changeCents };
}
