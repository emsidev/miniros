import { describe, expect, it } from "vitest";
import {
  calculateIngredientCostCents,
  calculateStandardRecipeCost,
  resolveEffectiveProductCost,
} from "../src/recipe-cost";

describe("recipe costing", () => {
  it("rounds the summed ingredient subtotal once", () => {
    expect(
      calculateIngredientCostCents([
        { unitCostCents: 1, quantity: "0.500" },
        { unitCostCents: 1, quantity: "0.500" },
      ]),
    ).toBe(1);
  });

  it("supports fractional quantities and standard cost additions", () => {
    expect(
      calculateStandardRecipeCost({
        lines: [
          { unitCostCents: 1200, quantity: "0.125" },
          { unitCostCents: 85, quantity: "2" },
        ],
        laborCostCents: 50,
        overheadCostCents: 25,
      }),
    ).toEqual({
      ingredientCostCents: 320,
      laborCostCents: 50,
      overheadCostCents: 25,
      totalCostCents: 395,
    });
  });

  it("accepts empty and zero-cost inputs", () => {
    expect(
      calculateStandardRecipeCost({
        lines: [],
        laborCostCents: 0,
        overheadCostCents: 0,
      }),
    ).toEqual({
      ingredientCostCents: 0,
      laborCostCents: 0,
      overheadCostCents: 0,
      totalCostCents: 0,
    });
  });

  it("rejects invalid inputs and unsafe totals", () => {
    expect(() =>
      calculateIngredientCostCents([{ unitCostCents: 100, quantity: "-1" }]),
    ).toThrow(/must not be negative/);
    expect(() =>
      calculateStandardRecipeCost({
        lines: [],
        laborCostCents: Number.MAX_SAFE_INTEGER,
        overheadCostCents: 1,
      }),
    ).toThrow(/safe integer range/);
  });

  it("resolves manual, recipe, and overridden effective costs", () => {
    const shared = {
      recipeLineCount: 2,
      manualCostCents: 4500,
      calculatedCostCents: 3950,
      costOverrideCents: null,
    };
    expect(
      resolveEffectiveProductCost({ ...shared, recipesEnabled: false }),
    ).toEqual({ costCents: 4500, costSource: "manual" });
    expect(
      resolveEffectiveProductCost({ ...shared, recipesEnabled: true }),
    ).toEqual({ costCents: 3950, costSource: "recipe" });
    expect(
      resolveEffectiveProductCost({
        ...shared,
        recipesEnabled: true,
        costOverrideCents: 4200,
      }),
    ).toEqual({ costCents: 4200, costSource: "override" });
    expect(
      resolveEffectiveProductCost({
        ...shared,
        recipesEnabled: true,
        recipeLineCount: 0,
        costOverrideCents: 4200,
      }),
    ).toEqual({ costCents: 4500, costSource: "manual" });
  });
});
