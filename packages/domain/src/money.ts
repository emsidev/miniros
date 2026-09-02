import {
  assertSafeInteger,
  bigintToSafeInteger,
  divideAndRoundHalfAwayFromZero,
} from "./internal/rounding";
import { QUANTITY_SCALE, quantityToScaledInteger } from "./quantity";

export type Cents = number;

export type MoneyFormatOptions = Readonly<{
  currency?: string;
  locale?: string;
}>;

export function assertCents(
  value: unknown,
  label = "amountCents",
): asserts value is Cents {
  assertSafeInteger(value, label);
}

export function assertNonNegativeCents(
  value: unknown,
  label = "amountCents",
): asserts value is Cents {
  assertCents(value, label);
  if (value < 0) {
    throw new RangeError(`${label} must not be negative.`);
  }
}

export function addCents(...amounts: readonly Cents[]): Cents {
  const total = amounts.reduce((sum, amount, index) => {
    assertCents(amount, `amounts[${index}]`);
    return sum + BigInt(amount);
  }, 0n);

  return bigintToSafeInteger(total, "cents total");
}

export const sumCents = addCents;

export function subtractCents(
  minuendCents: Cents,
  subtrahendCents: Cents,
): Cents {
  assertCents(minuendCents, "minuendCents");
  assertCents(subtrahendCents, "subtrahendCents");

  return bigintToSafeInteger(
    BigInt(minuendCents) - BigInt(subtrahendCents),
    "cents difference",
  );
}

export function multiplyCentsByQuantity(
  amountCents: Cents,
  quantity: number | string,
): Cents {
  assertCents(amountCents);
  const scaledQuantity = quantityToScaledInteger(quantity);
  const product = BigInt(amountCents) * BigInt(scaledQuantity);
  const rounded = divideAndRoundHalfAwayFromZero(
    product,
    BigInt(QUANTITY_SCALE),
  );

  return bigintToSafeInteger(rounded, "cents product");
}

export function divideCents(amountCents: Cents, divisor: number): Cents {
  assertCents(amountCents);
  assertSafeInteger(divisor, "divisor");
  if (divisor <= 0) {
    throw new RangeError("divisor must be greater than zero.");
  }

  return bigintToSafeInteger(
    divideAndRoundHalfAwayFromZero(BigInt(amountCents), BigInt(divisor)),
    "cents quotient",
  );
}

export function percentageOfCents(
  amountCents: Cents,
  percentage: number,
): Cents {
  assertNonNegativeCents(amountCents);
  if (!Number.isFinite(percentage) || percentage < 0) {
    throw new RangeError("percentage must not be negative.");
  }

  const percentageBasisPoints = Math.round(percentage * 100);
  assertSafeInteger(percentageBasisPoints, "percentage basis points");
  return bigintToSafeInteger(
    divideAndRoundHalfAwayFromZero(
      BigInt(amountCents) * BigInt(percentageBasisPoints),
      10_000n,
    ),
    "percentage cents",
  );
}

export function allocateDiscountCents(
  lineSubtotalsCents: readonly Cents[],
  discountCents: Cents,
): Cents[] {
  assertNonNegativeCents(discountCents, "discountCents");
  let remainingCents = Math.min(
    discountCents,
    addCents(
      ...lineSubtotalsCents.map((subtotal, index) => {
        assertNonNegativeCents(subtotal, `lineSubtotalsCents[${index}]`);
        return subtotal;
      }),
    ),
  );

  return lineSubtotalsCents.map((subtotal, index) => {
    assertNonNegativeCents(subtotal, `lineSubtotalsCents[${index}]`);
    const allocated = Math.min(subtotal, remainingCents);
    remainingCents -= allocated;
    return allocated;
  });
}

export function splitCents(amountCents: Cents, partCount: number): Cents[] {
  assertCents(amountCents);
  assertSafeInteger(partCount, "partCount");
  if (partCount <= 0) {
    throw new RangeError("partCount must be greater than zero.");
  }

  const amount = BigInt(amountCents);
  const parts = BigInt(partCount);
  const basePart = amount / parts;
  const remainder = amount % parts;
  const remainderCount = Number(remainder < 0n ? -remainder : remainder);
  const remainderStep = remainder < 0n ? -1n : 1n;

  return Array.from({ length: partCount }, (_, index) =>
    bigintToSafeInteger(
      basePart + (index < remainderCount ? remainderStep : 0n),
      "split part",
    ),
  );
}

export function formatMoney(
  amountCents: Cents,
  options: MoneyFormatOptions = {},
): string {
  assertCents(amountCents);

  return new Intl.NumberFormat(options.locale ?? "en-PH", {
    style: "currency",
    currency: options.currency ?? "PHP",
    currencyDisplay: "symbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}
