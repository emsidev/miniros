import { requireDatabase } from "@miniros/db";
import {
  productRecipeItems,
  productionLogs,
  products,
  shifts,
} from "@miniros/db/schema";
import {
  aggregateInventoryDeductions,
  normalizeQuantity,
} from "@miniros/domain";
import { and, eq, isNull, or } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import { applyInventoryDeltas, databaseQuantity } from "./inventory-ledger";
import {
  getShiftInventoryLocation,
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
} from "./operational-helpers";

export type LogProductionInput = {
  productionLogId: string;
  inventoryEventId: string;
  shiftId: string;
  productId: string;
  quantityProduced: number | string;
  notes?: string | null;
};

export async function logShiftProduction(input: LogProductionInput) {
  const access = await requireActiveBusiness({
    employeePermission: "production",
    assignedShiftId: input.shiftId,
  });
  requireEmployee(access);
  const quantityProduced = normalizeQuantity(input.quantityProduced);
  if (quantityProduced <= 0) {
    throw new AccessError("Production quantity must be positive.");
  }
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: productionLogs.id,
        shiftId: productionLogs.shiftId,
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
        existing.shiftId !== input.shiftId ||
        existing.productId !== input.productId
      ) {
        throw new AccessError("The production request ID is already in use.");
      }
      return { ...existing, idempotent: true };
    }

    const [shift] = await tx
      .select({
        id: shifts.id,
        sellingLocationId: shifts.sellingLocationId,
        status: shifts.status,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, input.shiftId),
          eq(shifts.businessId, access.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!shift) throw new AccessError("Shift not found.");
    if (shift.status !== "active") {
      const [raced] = await tx
        .select({
          id: productionLogs.id,
          shiftId: productionLogs.shiftId,
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
        raced?.shiftId === input.shiftId &&
        raced.productId === input.productId
      ) {
        return { ...raced, idempotent: true };
      }
      throw new AccessError("Production logging requires an active shift.");
    }
    await requireCurrentAssignment(
      tx,
      access.business.id,
      shift.id,
      access.employee.id,
    );
    const inventoryLocation = await getShiftInventoryLocation(
      tx,
      access.business.id,
      shift.id,
    );
    if (inventoryLocation.sellingLocationId !== shift.sellingLocationId) {
      throw new AccessError("The shift inventory location is inconsistent.");
    }

    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.id, input.productId),
          eq(products.businessId, access.business.id),
          eq(products.status, "active"),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!product) throw new AccessError("Product not found.");

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
        shiftId: shift.id,
        productId: product.id,
        inventoryLocationId: inventoryLocation.id,
        quantityProduced: databaseQuantity(quantityProduced),
        unit: "pcs",
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
        raced?.shiftId === input.shiftId &&
        raced.productId === input.productId
      ) {
        return { ...raced, idempotent: true };
      }
      throw new AccessError("The production request ID is already in use.");
    }

    await applyInventoryDeltas(tx, {
      businessId: access.business.id,
      shiftId: shift.id,
      inventoryLocationId: inventoryLocation.id,
      eventId: input.inventoryEventId,
      eventType: "production_input",
      sourceType: "production_log",
      sourceId: input.productionLogId,
      employeeId: access.employee.id,
      notes: input.notes,
      lines: deductions,
    });
    await insertAuditLog(tx, access, {
      action: "production.logged",
      entityType: "production_log",
      entityId: input.productionLogId,
      shiftId: shift.id,
      metadata: {
        productId: product.id,
        quantityProduced,
        inventoryEventId: input.inventoryEventId,
      },
    });

    return {
      id: input.productionLogId,
      shiftId: shift.id,
      productId: product.id,
      quantityProduced: databaseQuantity(quantityProduced),
      idempotent: false,
    };
  });
}
