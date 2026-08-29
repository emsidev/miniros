import { describe, expect, it } from "vitest";
import {
  addCents,
  allocateDiscountCents,
  divideCents,
  formatMoney,
  multiplyCentsByQuantity,
  percentageOfCents,
  splitCents,
  subtractCents,
} from "../src/money";

describe("money utilities", () => {
  it("adds and subtracts integer cents exactly", () => {
    expect(addCents(10, 20, -5)).toBe(25);
    expect(addCents()).toBe(0);
    expect(subtractCents(10, 35)).toBe(-25);
  });

  it("rejects fractional and unsafe cent values", () => {
    expect(() => addCents(1.5)).toThrow(/safe integer/);
    expect(() => addCents(Number.MAX_SAFE_INTEGER, 1)).toThrow(
      /safe integer range/,
    );
  });

  it("multiplies cents by a normalized quantity with half-away rounding", () => {
    expect(multiplyCentsByQuantity(199, 1.5)).toBe(299);
    expect(multiplyCentsByQuantity(1, 0.5)).toBe(1);
    expect(multiplyCentsByQuantity(-1, 0.5)).toBe(-1);
  });

  it("divides cents using the same deterministic rounding rule", () => {
    expect(divideCents(5, 2)).toBe(3);
    expect(divideCents(-5, 2)).toBe(-3);
    expect(() => divideCents(100, 0)).toThrow(/greater than zero/);
  });

  it("splits every cent while preserving positive and negative totals", () => {
    expect(splitCents(10, 3)).toEqual([4, 3, 3]);
    expect(splitCents(-10, 3)).toEqual([-4, -3, -3]);
    expect(splitCents(2, 3)).toEqual([1, 1, 0]);
    expect(addCents(...splitCents(101, 6))).toBe(101);
    expect(() => splitCents(100, 0)).toThrow(/greater than zero/);
  });

  it("formats cents as Philippine pesos by default", () => {
    expect(formatMoney(123456)).toBe("₱1,234.56");
    expect(formatMoney(-50)).toBe("-₱0.50");
    expect(formatMoney(123456, { currency: "USD", locale: "en-US" })).toBe(
      "$1,234.56",
    );
  });

  it("calculates percentage discounts with cent-safe rounding", () => {
    expect(percentageOfCents(1_000, 10)).toBe(100);
    expect(percentageOfCents(1, 50)).toBe(1);
    expect(() => percentageOfCents(100, -1)).toThrow(/negative/);
  });

  it("allocates a discount across line subtotals without exceeding a line", () => {
    expect(allocateDiscountCents([100, 250, 300], 275)).toEqual([100, 175, 0]);
    expect(allocateDiscountCents([100, 250], 500)).toEqual([100, 250]);
  });
});
