import { describe, expect, it } from "vitest";
import {
  calculateShiftProfit,
  classifyProfit,
  multiplyCentsByQuantity,
} from "../src";

describe("shift profit", () => {
  it("calculates the complete shift snapshot using the required formula", () => {
    expect(
      calculateShiftProfit({
        grossSalesCents: 50_000,
        totalDiscountsCents: 2_000,
        netSalesCents: 48_000,
        cashSalesCents: 30_000,
        nonCashSalesCents: 18_000,
        salaryCostCents: 5_000,
        rentalCostCents: 10_000,
        transportCostCents: 2_000,
        approvedDeductionsCents: 1_000,
        otherCostsCents: 500,
        productCostCents: 4_500,
      }),
    ).toEqual({
      grossSalesCents: 50_000,
      totalDiscountsCents: 2_000,
      netSalesCents: 48_000,
      cashSalesCents: 30_000,
      nonCashSalesCents: 18_000,
      salaryCostCents: 5_000,
      rentalCostCents: 10_000,
      transportCostCents: 2_000,
      approvedDeductionsCents: 1_000,
      otherCostsCents: 500,
      productCostCents: 4_500,
      totalCostsCents: 23_000,
      profitCents: 27_000,
      result: "profit",
    });
  });

  it("includes fractional sold-unit cost in total costs and profit", () => {
    const productCostCents = multiplyCentsByQuantity(125, "1.500");
    expect(productCostCents).toBe(188);
    expect(
      calculateShiftProfit({
        grossSalesCents: 1_000,
        productCostCents,
        otherCostsCents: 112,
      }),
    ).toMatchObject({
      productCostCents: 188,
      totalCostsCents: 300,
      profitCents: 700,
      result: "profit",
    });
  });

  it("classifies profit, break-even, and loss", () => {
    expect(classifyProfit(1)).toBe("profit");
    expect(classifyProfit(0)).toBe("break_even");
    expect(classifyProfit(-1)).toBe("loss");
    expect(calculateShiftProfit({ grossSalesCents: 1_000 })).toMatchObject({
      totalCostsCents: 0,
      profitCents: 1_000,
      result: "profit",
    });
    expect(
      calculateShiftProfit({
        grossSalesCents: 1_000,
        rentalCostCents: 1_000,
      }),
    ).toMatchObject({ profitCents: 0, result: "break_even" });
    expect(
      calculateShiftProfit({
        grossSalesCents: 1_000,
        rentalCostCents: 1_001,
      }),
    ).toMatchObject({ profitCents: -1, result: "loss" });
  });

  it("rejects invalid sales and cost values", () => {
    expect(() => classifyProfit(Number.NaN)).toThrow(/safe integer/);
    expect(() => calculateShiftProfit({ grossSalesCents: 1.5 })).toThrow(
      /safe integer/,
    );
    expect(() =>
      calculateShiftProfit({ grossSalesCents: 100, rentalCostCents: -1 }),
    ).toThrow(/must not be negative/);
  });
});
