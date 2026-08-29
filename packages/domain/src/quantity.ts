import {
  assertSafeInteger,
  bigintToSafeInteger,
  divideAndRoundHalfAwayFromZero,
} from "./internal/rounding";

export const QUANTITY_DECIMAL_PLACES = 3;
export const QUANTITY_SCALE = 10 ** QUANTITY_DECIMAL_PLACES;

export type QuantityInput = number | string;

export type QuantityProduct = Readonly<{
  multiplicand: QuantityInput;
  multiplier: QuantityInput;
}>;

const DECIMAL_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

function toQuantityString(value: QuantityInput): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("quantity must be finite.");
    }

    return String(value);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TypeError("quantity must not be empty.");
  }

  return trimmed;
}

function parseScaledQuantity(value: QuantityInput): bigint {
  const rawValue = toQuantityString(value);
  const match = DECIMAL_PATTERN.exec(rawValue);

  if (!match || (match[2]?.length === 0 && match[3]?.length === 0)) {
    throw new TypeError("quantity must be a decimal number.");
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const integerPart = match[2] || "0";
  const fractionalPart = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");

  if (!Number.isSafeInteger(exponent)) {
    throw new RangeError("quantity exponent is outside the supported range.");
  }

  const magnitudeText = `${integerPart}${fractionalPart}`.replace(/^0+/, "");
  const magnitude = BigInt(magnitudeText || "0");
  if (magnitude === 0n) {
    return 0n;
  }

  const power = QUANTITY_DECIMAL_PLACES + exponent - fractionalPart.length;
  if (power >= 0 && magnitudeText.length + power > 16) {
    throw new RangeError("quantity exceeds the supported safe integer range.");
  }

  if (power >= 0) {
    return sign * magnitude * 10n ** BigInt(power);
  }

  const divisorPower = -power;
  if (divisorPower > magnitudeText.length + 1) {
    return 0n;
  }

  const divisor = 10n ** BigInt(divisorPower);
  return divideAndRoundHalfAwayFromZero(sign * magnitude, divisor);
}

export function quantityToScaledInteger(value: QuantityInput): number {
  return bigintToSafeInteger(parseScaledQuantity(value), "quantity");
}

export function quantityFromScaledInteger(value: number): number {
  assertSafeInteger(value, "scaled quantity");
  return value / QUANTITY_SCALE;
}

export function normalizeQuantity(value: QuantityInput): number {
  return quantityFromScaledInteger(quantityToScaledInteger(value));
}

export function sumQuantities(values: readonly QuantityInput[]): number {
  const total = values.reduce(
    (sum, value) => sum + parseScaledQuantity(value),
    0n,
  );

  return quantityFromScaledInteger(
    bigintToSafeInteger(total, "quantity total"),
  );
}

export function sumQuantityProducts(
  products: readonly QuantityProduct[],
): number {
  // Preserve six-decimal intermediate products and round only the final sum.
  const unroundedTotal = products.reduce(
    (sum, product) =>
      sum +
      parseScaledQuantity(product.multiplicand) *
        parseScaledQuantity(product.multiplier),
    0n,
  );
  const roundedTotal = divideAndRoundHalfAwayFromZero(
    unroundedTotal,
    BigInt(QUANTITY_SCALE),
  );

  return quantityFromScaledInteger(
    bigintToSafeInteger(roundedTotal, "scaled quantity product"),
  );
}

export function scaleQuantity(
  quantityPerUnit: QuantityInput,
  unitCount: QuantityInput,
): number {
  return sumQuantityProducts([
    { multiplicand: quantityPerUnit, multiplier: unitCount },
  ]);
}

export function formatQuantity(value: QuantityInput): string {
  const scaledValue = quantityToScaledInteger(value);
  const sign = scaledValue < 0 ? "-" : "";
  const magnitude = Math.abs(scaledValue);
  const integerPart = Math.floor(magnitude / QUANTITY_SCALE);
  const fractionalPart = String(magnitude % QUANTITY_SCALE)
    .padStart(QUANTITY_DECIMAL_PLACES, "0")
    .replace(/0+$/, "");

  return `${sign}${integerPart}${fractionalPart ? `.${fractionalPart}` : ""}`;
}
