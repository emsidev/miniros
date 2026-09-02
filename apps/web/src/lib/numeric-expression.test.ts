import { describe, expect, it } from "vitest";
import {
  evaluateNumericExpression,
  formatNumericExpression,
  normalizeNumericExpression,
} from "./numeric-expression";

describe("numeric expressions", () => {
  it("evaluates arithmetic with standard precedence", () => {
    expect(evaluateNumericExpression("2 + 3 * 4")).toEqual({
      ok: true,
      value: 14,
    });
    expect(evaluateNumericExpression("(2 + 3) * 4")).toEqual({
      ok: true,
      value: 20,
    });
  });

  it("supports decimals, unary values, and unicode operators", () => {
    expect(evaluateNumericExpression("-.5 + 1.25")).toEqual({
      ok: true,
      value: 0.75,
    });
    expect(evaluateNumericExpression("(10 − 2) × 3 ÷ 4")).toEqual({
      ok: true,
      value: 6,
    });
  });

  it("rejects invalid calculations", () => {
    expect(evaluateNumericExpression("2 / 0")).toEqual({
      ok: false,
      error: "Cannot divide by zero.",
    });
    expect(evaluateNumericExpression("(2 + 3")).toEqual({
      ok: false,
      error: "Close each opening parenthesis.",
    });
    expect(evaluateNumericExpression("2 ** 3")).toEqual({
      ok: false,
      error: "Expected a number.",
    });
    expect(evaluateNumericExpression("999999999999999999999")).toEqual({
      ok: false,
      error: "Calculation is too large.",
    });
  });

  it("formats results at the requested precision", () => {
    expect(formatNumericExpression(10 / 3, 2)).toBe("3.33");
    expect(formatNumericExpression(10 / 3, 3)).toBe("3.333");
    expect(formatNumericExpression(-0.0001, 2)).toBe("0.00");
    expect(normalizeNumericExpression("10 / 3", 3)).toBe("3.333");
  });
});
