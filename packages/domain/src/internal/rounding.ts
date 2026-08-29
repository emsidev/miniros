const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

export function assertSafeInteger(
  value: unknown,
  label = "value",
): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer.`);
  }
}

export function bigintToSafeInteger(value: bigint, label = "result"): number {
  if (value > MAX_SAFE_INTEGER_BIGINT || value < MIN_SAFE_INTEGER_BIGINT) {
    throw new RangeError(`${label} exceeds the safe integer range.`);
  }

  return Number(value);
}

export function divideAndRoundHalfAwayFromZero(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator <= 0n) {
    throw new RangeError("denominator must be greater than zero.");
  }

  const sign = numerator < 0n ? -1n : 1n;
  const magnitude = numerator < 0n ? -numerator : numerator;
  const quotient = magnitude / denominator;
  const remainder = magnitude % denominator;
  const roundedMagnitude =
    remainder * 2n >= denominator ? quotient + 1n : quotient;

  return sign * roundedMagnitude;
}
