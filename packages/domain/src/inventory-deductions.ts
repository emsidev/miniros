import {
  type QuantityInput,
  quantityToScaledInteger,
  sumQuantityProducts,
} from "./quantity";

export type SaleItemForDeduction = Readonly<{
  productId: string;
  quantitySold: QuantityInput;
  requiresRecipeDeduction?: boolean;
}>;

export type RecipeItemForDeduction = Readonly<{
  productId: string;
  inventoryItemId: string;
  quantityPerProduct: QuantityInput;
  unit: string;
}>;

export type InventoryDeductionLine = Readonly<{
  inventoryItemId: string;
  /** A consumption ledger delta; always negative. */
  quantityDelta: number;
  unit: string;
}>;

type PendingDeduction = {
  products: Array<{
    multiplicand: QuantityInput;
    multiplier: QuantityInput;
  }>;
  unit: string;
};

function requireNonBlank(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TypeError(`${label} must not be empty.`);
  }

  return trimmed;
}

function requireNonNegativeQuantity(value: QuantityInput, label: string): void {
  if (quantityToScaledInteger(value) < 0) {
    throw new RangeError(`${label} must not be negative.`);
  }
}

export function aggregateInventoryDeductions(
  saleItems: readonly SaleItemForDeduction[],
  recipeItems: readonly RecipeItemForDeduction[],
): InventoryDeductionLine[] {
  const recipesByProduct = new Map<string, RecipeItemForDeduction[]>();

  recipeItems.forEach((recipeItem, index) => {
    const productId = requireNonBlank(
      recipeItem.productId,
      `recipeItems[${index}].productId`,
    );
    requireNonBlank(
      recipeItem.inventoryItemId,
      `recipeItems[${index}].inventoryItemId`,
    );
    requireNonBlank(recipeItem.unit, `recipeItems[${index}].unit`);
    requireNonNegativeQuantity(
      recipeItem.quantityPerProduct,
      `recipeItems[${index}].quantityPerProduct`,
    );

    const productRecipes = recipesByProduct.get(productId) ?? [];
    productRecipes.push(recipeItem);
    recipesByProduct.set(productId, productRecipes);
  });

  const pendingByInventoryItem = new Map<string, PendingDeduction>();

  saleItems.forEach((saleItem, saleIndex) => {
    const productId = requireNonBlank(
      saleItem.productId,
      `saleItems[${saleIndex}].productId`,
    );
    requireNonNegativeQuantity(
      saleItem.quantitySold,
      `saleItems[${saleIndex}].quantitySold`,
    );

    if (
      saleItem.requiresRecipeDeduction === false ||
      quantityToScaledInteger(saleItem.quantitySold) === 0
    ) {
      return;
    }

    const productRecipes = recipesByProduct.get(productId);
    if (!productRecipes || productRecipes.length === 0) {
      throw new Error(`No recipe exists for product ${productId}.`);
    }

    productRecipes.forEach((recipeItem) => {
      const inventoryItemId = recipeItem.inventoryItemId.trim();
      const unit = recipeItem.unit.trim();
      const pending = pendingByInventoryItem.get(inventoryItemId);

      if (pending && pending.unit !== unit) {
        throw new Error(
          `Inventory item ${inventoryItemId} has incompatible recipe units.`,
        );
      }

      const nextPending = pending ?? { products: [], unit };
      nextPending.products.push({
        multiplicand: recipeItem.quantityPerProduct,
        multiplier: saleItem.quantitySold,
      });
      pendingByInventoryItem.set(inventoryItemId, nextPending);
    });
  });

  return [...pendingByInventoryItem.entries()]
    .map(([inventoryItemId, pending]) => ({
      inventoryItemId,
      quantityDelta: -sumQuantityProducts(pending.products),
      unit: pending.unit,
    }))
    .filter((line) => line.quantityDelta !== 0)
    .sort((left, right) =>
      left.inventoryItemId.localeCompare(right.inventoryItemId),
    );
}

export const calculateInventoryDeductions = aggregateInventoryDeductions;
