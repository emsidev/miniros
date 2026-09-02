import { assertNonNegativeCents, type Cents } from "./money";
import {
  bigintToSafeInteger,
  divideAndRoundHalfAwayFromZero,
} from "./internal/rounding";
import { QUANTITY_SCALE, quantityToScaledInteger } from "./quantity";

export type RecipeCostLine = Readonly<{
  quantity: number | string;
  unitCostCents: Cents;
}>;

export type StandardRecipeCost = Readonly<{
  ingredientCostCents: Cents;
  laborCostCents: Cents;
  overheadCostCents: Cents;
  totalCostCents: Cents;
}>;

export type RecipeCostSource = "manual" | "recipe" | "override";

export type EffectiveProductCost = Readonly<{
  costCents: Cents;
  costSource: RecipeCostSource;
}>;

export function calculateIngredientCostCents(
  lines: readonly RecipeCostLine[],
): Cents {
  const scaledTotal = lines.reduce((total, line, index) => {
    assertNonNegativeCents(line.unitCostCents, `lines[${index}].unitCostCents`);
    const scaledQuantity = quantityToScaledInteger(line.quantity);
    if (scaledQuantity < 0) {
      throw new RangeError(`lines[${index}].quantity must not be negative.`);
    }
    return total + BigInt(line.unitCostCents) * BigInt(scaledQuantity);
  }, 0n);

  return bigintToSafeInteger(
    divideAndRoundHalfAwayFromZero(scaledTotal, BigInt(QUANTITY_SCALE)),
    "ingredient cost cents",
  );
}

export function calculateStandardRecipeCost(input: {
  lines: readonly RecipeCostLine[];
  laborCostCents: Cents;
  overheadCostCents: Cents;
}): StandardRecipeCost {
  assertNonNegativeCents(input.laborCostCents, "laborCostCents");
  assertNonNegativeCents(input.overheadCostCents, "overheadCostCents");
  const ingredientCostCents = calculateIngredientCostCents(input.lines);
  const totalCostCents = bigintToSafeInteger(
    BigInt(ingredientCostCents) +
      BigInt(input.laborCostCents) +
      BigInt(input.overheadCostCents),
    "standard recipe cost cents",
  );

  return {
    ingredientCostCents,
    laborCostCents: input.laborCostCents,
    overheadCostCents: input.overheadCostCents,
    totalCostCents,
  };
}

export function resolveEffectiveProductCost(input: {
  recipesEnabled: boolean;
  recipeLineCount: number;
  manualCostCents: Cents;
  calculatedCostCents: Cents;
  costOverrideCents: Cents | null;
}): EffectiveProductCost {
  assertNonNegativeCents(input.manualCostCents, "manualCostCents");
  assertNonNegativeCents(input.calculatedCostCents, "calculatedCostCents");
  if (input.costOverrideCents !== null) {
    assertNonNegativeCents(input.costOverrideCents, "costOverrideCents");
  }
  if (
    !Number.isSafeInteger(input.recipeLineCount) ||
    input.recipeLineCount < 0
  ) {
    throw new RangeError("recipeLineCount must be a nonnegative safe integer.");
  }

  if (!input.recipesEnabled || input.recipeLineCount === 0) {
    return { costCents: input.manualCostCents, costSource: "manual" };
  }
  if (input.costOverrideCents !== null) {
    return { costCents: input.costOverrideCents, costSource: "override" };
  }
  return { costCents: input.calculatedCostCents, costSource: "recipe" };
}
