import {
  quantityToScaledInteger,
  sumQuantities,
  sumQuantityProducts,
  type QuantityInput,
} from "./quantity";

export type PosStockRequirement = Readonly<{
  inventoryItemId: string;
  quantityPerUnit: QuantityInput;
}>;

export type PosStockProduct = Readonly<{
  productId: string;
  stockTracked?: boolean;
  requirements: readonly PosStockRequirement[];
}>;

export type PosInventoryBalance = Readonly<{
  inventoryItemId: string;
  quantity: QuantityInput;
}>;

export type PosCartQuantity = Readonly<{
  productId: string;
  quantity: QuantityInput;
}>;

type ConsolidatedRequirement = {
  inventoryItemId: string;
  quantityPerUnit: number;
};

function requireId(value: string, label: string) {
  const id = value.trim();
  if (!id) throw new TypeError(`${label} must not be empty.`);
  return id;
}

function consolidateRequirements(
  requirements: readonly PosStockRequirement[],
): ConsolidatedRequirement[] {
  const byItem = new Map<string, QuantityInput[]>();

  requirements.forEach((requirement, index) => {
    const inventoryItemId = requireId(
      requirement.inventoryItemId,
      `requirements[${index}].inventoryItemId`,
    );
    if (quantityToScaledInteger(requirement.quantityPerUnit) <= 0) {
      throw new RangeError(
        `requirements[${index}].quantityPerUnit must be positive.`,
      );
    }
    const quantities = byItem.get(inventoryItemId) ?? [];
    quantities.push(requirement.quantityPerUnit);
    byItem.set(inventoryItemId, quantities);
  });

  return [...byItem.entries()].map(([inventoryItemId, quantities]) => ({
    inventoryItemId,
    quantityPerUnit: sumQuantities(quantities),
  }));
}

/**
 * Returns the maximum whole quantity of one product that may be in the cart.
 * `null` means the product is not stock-limited. Other cart lines are deducted
 * first so products that share an ingredient cannot independently over-commit it.
 */
export function calculatePosAvailableQuantity(input: {
  productId: string;
  products: readonly PosStockProduct[];
  balances: readonly PosInventoryBalance[];
  cart: readonly PosCartQuantity[];
}): number | null {
  const targetProductId = requireId(input.productId, "productId");
  const stockProducts = new Map(
    input.products.map((product, index) => {
      const requirements = consolidateRequirements(product.requirements);
      return [
        requireId(product.productId, `products[${index}].productId`),
        {
          requirements,
          stockTracked: product.stockTracked ?? requirements.length > 0,
        },
      ];
    }),
  );
  const target = stockProducts.get(targetProductId);
  if (!target) throw new RangeError("Product is not in the catalog.");
  if (!target.stockTracked) return null;
  if (target.requirements.length === 0) return 0;

  const balanceByItem = new Map<string, number>();
  input.balances.forEach((balance, index) => {
    const inventoryItemId = requireId(
      balance.inventoryItemId,
      `balances[${index}].inventoryItemId`,
    );
    const quantity = quantityToScaledInteger(balance.quantity);
    if (quantity < 0) {
      throw new RangeError(`balances[${index}].quantity must not be negative.`);
    }
    balanceByItem.set(inventoryItemId, quantity);
  });

  const consumptionByItem = new Map<string, QuantityInput[]>();
  input.cart.forEach((line, index) => {
    const productId = requireId(line.productId, `cart[${index}].productId`);
    const quantity = quantityToScaledInteger(line.quantity);
    if (quantity < 0) {
      throw new RangeError(`cart[${index}].quantity must not be negative.`);
    }
    if (productId === targetProductId || quantity === 0) return;

    const product = stockProducts.get(productId);
    if (!product) throw new RangeError("Cart product is not in the catalog.");
    product.requirements.forEach((requirement) => {
      const quantities =
        consumptionByItem.get(requirement.inventoryItemId) ?? [];
      quantities.push(
        sumQuantityProducts([
          {
            multiplicand: requirement.quantityPerUnit,
            multiplier: line.quantity,
          },
        ]),
      );
      consumptionByItem.set(requirement.inventoryItemId, quantities);
    });
  });

  return target.requirements.reduce((maximum, requirement) => {
    const balance = balanceByItem.get(requirement.inventoryItemId) ?? 0;
    const consumed = quantityToScaledInteger(
      sumQuantities(consumptionByItem.get(requirement.inventoryItemId) ?? []),
    );
    const remaining = Math.max(0, balance - consumed);
    const perUnit = quantityToScaledInteger(requirement.quantityPerUnit);
    return Math.min(maximum, Math.floor(remaining / perUnit));
  }, Number.MAX_SAFE_INTEGER);
}
