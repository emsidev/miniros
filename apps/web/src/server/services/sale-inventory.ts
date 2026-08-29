import { productRecipeItems } from "@miniros/db/schema";
import { aggregateInventoryDeductions } from "@miniros/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { applyInventoryDeltas } from "./inventory-ledger";
import type { OperationalTransaction } from "./operational-helpers";

export async function deductSaleInventory(
  tx: OperationalTransaction,
  input: {
    businessId: string;
    shiftId: string;
    inventoryLocationId: string;
    inventoryEventId: string;
    saleId: string;
    employeeId: string;
    items: readonly {
      productId: string;
      quantity: string;
      requiresRecipeDeduction: boolean;
    }[];
  },
) {
  const recipeProductIds = [
    ...new Set(
      input.items
        .filter((item) => item.requiresRecipeDeduction)
        .map((item) => item.productId),
    ),
  ];
  if (recipeProductIds.length === 0) return;

  const recipeRows = await tx
    .select({
      productId: productRecipeItems.productId,
      inventoryItemId: productRecipeItems.inventoryItemId,
      quantityPerProduct: productRecipeItems.quantity,
      unit: productRecipeItems.unit,
    })
    .from(productRecipeItems)
    .where(
      and(
        eq(productRecipeItems.businessId, input.businessId),
        inArray(productRecipeItems.productId, recipeProductIds),
        isNull(productRecipeItems.deletedAt),
      ),
    );
  const deductions = aggregateInventoryDeductions(
    input.items.map((item) => ({
      productId: item.productId,
      quantitySold: item.quantity,
      requiresRecipeDeduction: item.requiresRecipeDeduction,
    })),
    recipeRows,
  );
  await applyInventoryDeltas(tx, {
    businessId: input.businessId,
    shiftId: input.shiftId,
    inventoryLocationId: input.inventoryLocationId,
    eventId: input.inventoryEventId,
    eventType: "sale_deduction",
    sourceType: "sale",
    sourceId: input.saleId,
    employeeId: input.employeeId,
    lines: deductions,
  });
}
