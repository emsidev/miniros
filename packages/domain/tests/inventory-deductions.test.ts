import { describe, expect, it } from "vitest";
import { aggregateInventoryDeductions } from "../src/inventory-deductions";

describe("aggregateInventoryDeductions", () => {
  it("scales recipes and aggregates shared inventory items", () => {
    const deductions = aggregateInventoryDeductions(
      [
        { productId: "matcha-latte", quantitySold: "2.000" },
        { productId: "ube-matcha", quantitySold: "1.500" },
      ],
      [
        {
          productId: "matcha-latte",
          inventoryItemId: "milk",
          quantityPerProduct: "0.125",
          unit: "L",
        },
        {
          productId: "matcha-latte",
          inventoryItemId: "cup",
          quantityPerProduct: "1.000",
          unit: "piece",
        },
        {
          productId: "ube-matcha",
          inventoryItemId: "milk",
          quantityPerProduct: "0.200",
          unit: "L",
        },
      ],
    );

    expect(deductions).toEqual([
      { inventoryItemId: "cup", quantityDelta: -2, unit: "piece" },
      { inventoryItemId: "milk", quantityDelta: -0.55, unit: "L" },
    ]);
  });

  it("rounds once per inventory item across repeated sale lines", () => {
    expect(
      aggregateInventoryDeductions(
        [
          { productId: "drink", quantitySold: "0.500" },
          { productId: "drink", quantitySold: "0.500" },
        ],
        [
          {
            productId: "drink",
            inventoryItemId: "powder",
            quantityPerProduct: "0.001",
            unit: "kg",
          },
        ],
      ),
    ).toEqual([
      { inventoryItemId: "powder", quantityDelta: -0.001, unit: "kg" },
    ]);
  });

  it("omits zero deductions and products explicitly exempt from recipes", () => {
    expect(
      aggregateInventoryDeductions(
        [
          {
            productId: "retail-item",
            quantitySold: 2,
            requiresRecipeDeduction: false,
          },
          { productId: "drink", quantitySold: 0 },
        ],
        [],
      ),
    ).toEqual([]);
  });

  it("fails closed when a recipe-required product has no recipe", () => {
    expect(() =>
      aggregateInventoryDeductions(
        [{ productId: "drink", quantitySold: 1 }],
        [],
      ),
    ).toThrow("No recipe exists for product drink.");
  });

  it("rejects negative inputs and incompatible units", () => {
    expect(() =>
      aggregateInventoryDeductions(
        [{ productId: "drink", quantitySold: -1 }],
        [],
      ),
    ).toThrow(/must not be negative/);

    expect(() =>
      aggregateInventoryDeductions(
        [{ productId: "drink", quantitySold: 1 }],
        [
          {
            productId: "drink",
            inventoryItemId: "milk",
            quantityPerProduct: 1,
            unit: "L",
          },
          {
            productId: "drink",
            inventoryItemId: "milk",
            quantityPerProduct: 1,
            unit: "ml",
          },
        ],
      ),
    ).toThrow(/incompatible recipe units/);
  });
});
