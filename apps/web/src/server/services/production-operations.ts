import { requireDatabase } from "@miniros/db";
import {
  inventoryItems,
  inventoryLocations,
  productRecipeItems,
  productProductionOutputs,
  productionLogs,
  products,
} from "@miniros/db/schema";
import {
  aggregateInventoryDeductions,
  normalizeQuantity,
} from "@miniros/domain";
import { and, eq, isNull, or } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import { applyInventoryDeltas, databaseQuantity } from "./inventory-ledger";
import { insertAuditLog, requireEmployee } from "./operational-helpers";

export type LogProductionInput = {
  productionLogId: string;
  productionInputEventId: string;
  productionOutputEventId: string;
  inventoryLocationId: string;
  productId: string;
  quantityProduced: number | string;
  notes?: string | null;
};

export async function logProduction(input: LogProductionInput) {
  const access = await requireActiveBusiness({
    feature: "production",
    employeePermission: "production",
  });
  requireEmployee(access);
  const quantityProduced = normalizeQuantity(input.quantityProduced);
  if (quantityProduced <= 0) {
    throw new AccessError("Production quantity must be positive.");
  }
  if (input.productionInputEventId === input.productionOutputEventId) {
    throw new AccessError(
      "Production input and output event IDs must be different.",
    );
  }
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: productionLogs.id,
        shiftId: productionLogs.shiftId,
        inventoryLocationId: productionLogs.inventoryLocationId,
        productId: productionLogs.productId,
        quantityProduced: productionLogs.quantityProduced,
      })
      .from(productionLogs)
      .where(
        and(
          eq(productionLogs.businessId, access.business.id),
          or(
            eq(productionLogs.id, input.productionLogId),
            eq(productionLogs.clientGeneratedId, input.productionLogId),
          ),
        ),
      )
      .limit(1);
    if (existing) {
      if (
        existing.shiftId !== null ||
        existing.inventoryLocationId !== input.inventoryLocationId ||
        existing.productId !== input.productId
      ) {
        throw new AccessError("The production request ID is already in use.");
      }
      return { ...existing, idempotent: true };
    }

    const [inventoryLocation] = await tx
      .select({
        id: inventoryLocations.id,
      })
      .from(inventoryLocations)
      .where(
        and(
          eq(inventoryLocations.id, input.inventoryLocationId),
          eq(inventoryLocations.businessId, access.business.id),
          eq(inventoryLocations.locationType, "central"),
          eq(inventoryLocations.status, "active"),
          isNull(inventoryLocations.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!inventoryLocation) {
      throw new AccessError("Select an active central inventory location.");
    }

    const [product] = await tx
      .select({
        id: products.id,
        outputInventoryItemId: productProductionOutputs.inventoryItemId,
        outputUnit: inventoryItems.unit,
        outputItemType: inventoryItems.itemType,
        outputTracksStock: inventoryItems.trackStock,
      })
      .from(products)
      .innerJoin(
        productProductionOutputs,
        and(
          eq(productProductionOutputs.productId, products.id),
          eq(productProductionOutputs.businessId, products.businessId),
        ),
      )
      .innerJoin(
        inventoryItems,
        and(
          eq(inventoryItems.id, productProductionOutputs.inventoryItemId),
          eq(inventoryItems.businessId, products.businessId),
          eq(inventoryItems.status, "active"),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .where(
        and(
          eq(products.id, input.productId),
          eq(products.businessId, access.business.id),
          eq(products.status, "active"),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (
      !product ||
      product.outputItemType !== "finished_good" ||
      !product.outputTracksStock
    ) {
      throw new AccessError(
        "This product needs an active tracked finished-good output item.",
      );
    }

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
          eq(productRecipeItems.businessId, access.business.id),
          eq(productRecipeItems.productId, product.id),
          isNull(productRecipeItems.deletedAt),
        ),
      );
    if (recipeRows.length === 0) {
      throw new AccessError("A recipe is required before logging production.");
    }
    const deductions = aggregateInventoryDeductions(
      [
        {
          productId: product.id,
          quantitySold: quantityProduced,
          requiresRecipeDeduction: true,
        },
      ],
      recipeRows,
    );

    const [created] = await tx
      .insert(productionLogs)
      .values({
        id: input.productionLogId,
        businessId: access.business.id,
        shiftId: null,
        productId: product.id,
        inventoryLocationId: inventoryLocation.id,
        quantityProduced: databaseQuantity(quantityProduced),
        unit: product.outputUnit,
        notes: input.notes?.trim() || null,
        loggedBy: access.employee.id,
        clientGeneratedId: input.productionLogId,
      })
      .onConflictDoNothing({
        target: [productionLogs.businessId, productionLogs.clientGeneratedId],
      })
      .returning({ id: productionLogs.id });
    if (!created) {
      const [raced] = await tx
        .select({
          id: productionLogs.id,
          shiftId: productionLogs.shiftId,
          inventoryLocationId: productionLogs.inventoryLocationId,
          productId: productionLogs.productId,
          quantityProduced: productionLogs.quantityProduced,
        })
        .from(productionLogs)
        .where(
          and(
            eq(productionLogs.businessId, access.business.id),
            eq(productionLogs.clientGeneratedId, input.productionLogId),
          ),
        )
        .limit(1);
      if (
        raced?.shiftId === null &&
        raced.inventoryLocationId === input.inventoryLocationId &&
        raced.productId === input.productId
      ) {
        return { ...raced, idempotent: true };
      }
      throw new AccessError("The production request ID is already in use.");
    }

    await applyInventoryDeltas(tx, {
      businessId: access.business.id,
      shiftId: null,
      inventoryLocationId: inventoryLocation.id,
      eventId: input.productionInputEventId,
      eventType: "production_input",
      sourceType: "production_log",
      sourceId: input.productionLogId,
      employeeId: access.employee.id,
      notes: input.notes,
      lines: deductions,
    });
    await applyInventoryDeltas(tx, {
      businessId: access.business.id,
      shiftId: null,
      inventoryLocationId: inventoryLocation.id,
      eventId: input.productionOutputEventId,
      eventType: "production_output",
      sourceType: "production_log",
      sourceId: input.productionLogId,
      employeeId: access.employee.id,
      notes: input.notes,
      lines: [
        {
          inventoryItemId: product.outputInventoryItemId,
          quantityDelta: quantityProduced,
          unit: product.outputUnit,
        },
      ],
    });
    await insertAuditLog(tx, access, {
      action: "production.logged",
      entityType: "production_log",
      entityId: input.productionLogId,
      shiftId: null,
      metadata: {
        productId: product.id,
        quantityProduced,
        inventoryLocationId: inventoryLocation.id,
        productionInputEventId: input.productionInputEventId,
        productionOutputEventId: input.productionOutputEventId,
      },
    });

    return {
      id: input.productionLogId,
      shiftId: null,
      inventoryLocationId: inventoryLocation.id,
      productId: product.id,
      quantityProduced: databaseQuantity(quantityProduced),
      idempotent: false,
    };
  });
}
