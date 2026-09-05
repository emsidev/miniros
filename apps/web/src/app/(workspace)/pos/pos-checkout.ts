import { validateProofFile } from "@miniros/contracts";
import {
  addCents,
  allocateDiscountCents,
  multiplyCentsByQuantity,
  percentageOfCents,
} from "@miniros/domain";
import { numericExpressionToNumber } from "../../../lib/numeric-expression";
import type {
  PaymentDraft,
  PosProduct,
  PosPromo,
  SubmittedPayment,
} from "./pos-types";

export function pesosToCents(value: string) {
  const pesos = numericExpressionToNumber(value);
  return Number.isFinite(pesos) ? Math.round(pesos * 100) : Number.NaN;
}

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export function createPaymentDraft(
  method: PaymentDraft["method"],
  totalCents = 0,
): PaymentDraft {
  return {
    id: crypto.randomUUID(),
    proofFileId: crypto.randomUUID(),
    method,
    amount: totalCents > 0 ? centsToInput(totalCents) : "",
    amountMode: "exact",
    reference: "",
    file: null,
  };
}

export function syncExactTender(
  payments: readonly PaymentDraft[],
  totalCents: number,
): PaymentDraft[] {
  if (payments.length !== 1 || payments[0]?.amountMode !== "exact") {
    return [...payments];
  }
  const amount = totalCents > 0 ? centsToInput(totalCents) : "";
  return payments[0].amount === amount
    ? [...payments]
    : [{ ...payments[0], amount }];
}

export function calculateCheckout(input: {
  products: readonly PosProduct[];
  cart: Readonly<Record<string, number>>;
  discount: string;
  promoId: string;
  promos: readonly PosPromo[];
}) {
  const cartLines = input.products
    .filter((product) => input.cart[product.id])
    .map((product) => ({
      ...product,
      quantity: input.cart[product.id] ?? 0,
    }));
  const lineSubtotalsCents = cartLines.map((line) =>
    multiplyCentsByQuantity(line.priceCents, line.quantity),
  );
  const subtotalCents = addCents(...lineSubtotalsCents);
  const manualDiscountCents = Math.max(0, pesosToCents(input.discount) || 0);
  const selectedPromo = input.promos.find(
    (promo) => promo.id === input.promoId,
  );
  const promoDiscountCents = selectedPromo
    ? selectedPromo.discountType === "fixed_amount"
      ? Math.round(selectedPromo.discountValue * 100)
      : percentageOfCents(subtotalCents, selectedPromo.discountValue)
    : 0;
  const requestedDiscountCents = selectedPromo
    ? promoDiscountCents
    : manualDiscountCents;
  const appliedDiscountCents = Math.min(subtotalCents, requestedDiscountCents);
  const totalCents = Math.max(0, subtotalCents - appliedDiscountCents);
  const lineDiscountsCents = allocateDiscountCents(
    lineSubtotalsCents,
    appliedDiscountCents,
  );

  return {
    cartLines,
    subtotalCents,
    appliedDiscountCents,
    totalCents,
    selectedPromo,
    cartItems: cartLines.map((line, index) => ({
      ...line,
      lineDiscountCents: lineDiscountsCents[index] ?? 0,
    })),
  };
}

export function preparePayments(payments: readonly PaymentDraft[]) {
  return payments
    .map((payment) => ({
      ...payment,
      amountCents: pesosToCents(payment.amount),
    }))
    .filter(
      (payment): payment is SubmittedPayment =>
        Number.isFinite(payment.amountCents) && payment.amountCents > 0,
    );
}

export function calculateTenderChangeCents(
  payments: readonly PaymentDraft[],
  totalCents: number,
) {
  const amountPaidCents = addCents(
    ...preparePayments(payments).map((payment) => payment.amountCents),
  );
  return Math.max(0, amountPaidCents - totalCents);
}

export function validateCheckout(input: {
  itemCount: number;
  totalCents: number;
  payments: readonly SubmittedPayment[];
  requiresPhoto?: boolean;
  discountPhoto?: File | null;
}) {
  if (input.itemCount === 0) return "Add at least one product to the order.";
  if (input.totalCents <= 0) return "The order total must be more than ₱0.";
  if (input.payments.length === 0) return "Add a payment amount.";
  if (
    input.payments.some(
      (payment) => payment.method !== "cash" && !payment.reference.trim(),
    )
  ) {
    return "Add a reference number for every non-cash payment.";
  }
  if (input.requiresPhoto) {
    const error = validateProofFile(input.discountPhoto, true);
    if (error) return error;
  }
  for (const payment of input.payments) {
    if (payment.method !== "cash" && payment.file) {
      const error = validateProofFile(payment.file);
      if (error) return error;
    }
  }
  const paidCents = addCents(
    ...input.payments.map((payment) => payment.amountCents),
  );
  if (paidCents < input.totalCents) {
    return "Payments do not cover the amount due.";
  }
  const cashCents = addCents(
    ...input.payments
      .filter((payment) => payment.method === "cash")
      .map((payment) => payment.amountCents),
  );
  if (paidCents - input.totalCents > cashCents) {
    return "Only cash can be returned as change.";
  }
  return null;
}
