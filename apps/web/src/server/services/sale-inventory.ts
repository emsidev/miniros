import type { PreparedOperationContext } from "./offline-context";
import { productRecipeItems } from "@miniros/db/schema";
import {
  aggregateInventoryDeductions,
  normalizeQuantity,
} from "@miniros/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { applyInventoryDeltas } from "./inventory-ledger";
import type { OperationalTransaction } from "./operational-helpers";

export async function deductSaleInventory(
  tx: OperationalTransaction,
  input: {
    prepared?: PreparedOperationContext;
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
      producedInventoryItemId: string | null;
    }[];
  },
) {
  const recipeProductIds = [
    ...new Set(
      input.items
        .filter(
          (item) =>
            item.requiresRecipeDeduction && !item.producedInventoryItemId,
        )
        .map((item) => item.productId),
    ),
  ];
  const recipeRows = input.prepared
    ? input.prepared.snapshot.recipes.filter((row) =>
        recipeProductIds.includes(row.productId),
      )
    : recipeProductIds.length === 0
      ? []
      : await tx
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
  const recipeDeductions = aggregateInventoryDeductions(
    input.items.map((item) => ({
      productId: item.productId,
      quantitySold: item.quantity,
      requiresRecipeDeduction:
        item.requiresRecipeDeduction && !item.producedInventoryItemId,
    })),
    recipeRows,
  );
  const deductions = new Map<
    string,
    { inventoryItemId: string; quantityDelta: number; unit?: string }
  >();
  const addDeduction = (
    inventoryItemId: string,
    quantityDelta: number | string,
    unit?: string,
  ) => {
    const current = deductions.get(inventoryItemId);
    if (current?.unit && unit && current.unit !== unit) {
      throw new Error("Inventory deductions use inconsistent units.");
    }
    deductions.set(inventoryItemId, {
      inventoryItemId,
      quantityDelta: normalizeQuantity(
        (current?.quantityDelta ?? 0) + normalizeQuantity(quantityDelta),
      ),
      unit: current?.unit ?? unit,
    });
  };
  recipeDeductions.forEach((deduction) => {
    addDeduction(
      deduction.inventoryItemId,
      deduction.quantityDelta,
      deduction.unit,
    );
  });
  input.items.forEach((item) => {
    if (item.producedInventoryItemId) {
      addDeduction(
        item.producedInventoryItemId,
        -normalizeQuantity(item.quantity),
      );
    }
  });
  if (deductions.size === 0) return;

  await applyInventoryDeltas(tx, {
    businessId: input.businessId,
    shiftId: input.shiftId,
    inventoryLocationId: input.inventoryLocationId,
    eventId: input.inventoryEventId,
    eventType: "sale_deduction",
    sourceType: "sale",
    sourceId: input.saleId,
    employeeId: input.employeeId,
    lines: [...deductions.values()],
    prepared: input.prepared,
  });
}
