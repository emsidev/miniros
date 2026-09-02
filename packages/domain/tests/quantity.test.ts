import { describe, expect, it } from "vitest";
import {
  formatQuantity,
  normalizeQuantity,
  quantityFromScaledInteger,
  quantityToScaledInteger,
  scaleQuantity,
  sumQuantities,
  sumQuantityProducts,
} from "../src/quantity";

describe("quantity utilities", () => {
  it("normalizes decimal inputs to three places", () => {
    expect(normalizeQuantity("1.2344")).toBe(1.234);
    expect(normalizeQuantity("1.2345")).toBe(1.235);
    expect(normalizeQuantity("-1.2345")).toBe(-1.235);
    expect(normalizeQuantity(".5")).toBe(0.5);
    expect(normalizeQuantity("2.5e-1")).toBe(0.25);
  });

  it("normalizes floating-point artifacts at the shared boundary", () => {
    expect(normalizeQuantity(0.1 + 0.2)).toBe(0.3);
    expect(sumQuantities([0.1, 0.2, "0.300"])).toBe(0.6);
  });

  it("converts between quantities and scaled integer milliunits", () => {
    expect(quantityToScaledInteger("12.345")).toBe(12345);
    expect(quantityFromScaledInteger(12345)).toBe(12.345);
    expect(() => quantityFromScaledInteger(1.5)).toThrow(/safe integer/);
  });

  it("scales recipe quantities without raw floating-point math", () => {
    expect(scaleQuantity("0.125", "3")).toBe(0.375);
    expect(scaleQuantity("0.333", "1.5")).toBe(0.5);
    expect(scaleQuantity("-0.001", "0.5")).toBe(-0.001);
  });

  it("rounds once after summing multiple quantity products", () => {
    expect(
      sumQuantityProducts([
        { multiplicand: "0.001", multiplier: "0.5" },
        { multiplicand: "0.001", multiplier: "0.5" },
      ]),
    ).toBe(0.001);
  });

  it("formats normalized quantities without insignificant zeroes", () => {
    expect(formatQuantity("12.340")).toBe("12.34");
    expect(formatQuantity("0.0004")).toBe("0");
    expect(formatQuantity("-0.125")).toBe("-0.125");
  });

  it("rejects malformed and out-of-range quantities", () => {
    expect(() => normalizeQuantity("one")).toThrow(/decimal number/);
    expect(() => normalizeQuantity(Number.POSITIVE_INFINITY)).toThrow(/finite/);
    expect(() => quantityToScaledInteger("9007199254740991")).toThrow(
      /safe integer range/,
    );
  });
});
