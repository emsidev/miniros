import { requireDatabase } from "@miniros/db";
import {
  inventoryAdjustments,
  inventoryItems,
  inventoryLocations,
  shifts,
} from "@miniros/db/schema";
import { normalizeQuantity } from "@miniros/domain";
import { and, eq, isNull } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import { applyInventoryDeltas, databaseQuantity } from "./inventory-ledger";
import {
  getShiftInventoryLocation,
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
} from "./operational-helpers";

export type SubmitInventoryAdjustmentInput = {
  adjustmentId: string;
  shiftId: string;
  inventoryItemId: string;
  quantityDelta: number | string;
  reason: string;
};

export async function submitInventoryAdjustment(
  input: SubmitInventoryAdjustmentInput,
) {
  const access = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: input.shiftId,
  });
  requireEmployee(access);
  const quantityDelta = normalizeQuantity(input.quantityDelta);
  if (quantityDelta === 0) {
    throw new AccessError("An inventory adjustment must not be zero.");
  }

  return requireDatabase().transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: inventoryAdjustments.id,
        shiftId: inventoryAdjustments.shiftId,
        status: inventoryAdjustments.status,
        quantityDelta: inventoryAdjustments.quantityDelta,
      })
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.id, input.adjustmentId),
          eq(inventoryAdjustments.businessId, access.business.id),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.shiftId !== input.shiftId) {
        throw new AccessError("The inventory adjustment ID is already in use.");
      }
      return { ...existing, idempotent: true };
    }

    const [shift] = await tx
      .select({ id: shifts.id, status: shifts.status })
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
    if (!shift || (shift.status !== "active" && shift.status !== "closing")) {
      throw new AccessError("Inventory adjustments require an open shift.");
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
    const [item] = await tx
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, input.inventoryItemId),
          eq(inventoryItems.businessId, access.business.id),
          eq(inventoryItems.status, "active"),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .limit(1);
    if (!item) throw new AccessError("Inventory item not found.");

    const [created] = await tx
      .insert(inventoryAdjustments)
      .values({
        id: input.adjustmentId,
        businessId: access.business.id,
        shiftId: shift.id,
        inventoryLocationId: inventoryLocation.id,
        inventoryItemId: item.id,
        quantityDelta: databaseQuantity(quantityDelta),
        reason: input.reason.trim(),
        status: "pending",
        requestedBy: access.employee.id,
      })
      .onConflictDoNothing()
      .returning({ id: inventoryAdjustments.id });
    if (!created) {
      const [raced] = await tx
        .select({
          id: inventoryAdjustments.id,
          shiftId: inventoryAdjustments.shiftId,
          status: inventoryAdjustments.status,
          quantityDelta: inventoryAdjustments.quantityDelta,
        })
        .from(inventoryAdjustments)
        .where(
          and(
            eq(inventoryAdjustments.id, input.adjustmentId),
            eq(inventoryAdjustments.businessId, access.business.id),
          ),
        )
        .limit(1);
      if (raced?.shiftId === input.shiftId) {
        return { ...raced, idempotent: true };
      }
      throw new AccessError("The inventory adjustment ID is already in use.");
    }
    await insertAuditLog(tx, access, {
      action: "inventory_adjustment.submitted",
      entityType: "inventory_adjustment",
      entityId: input.adjustmentId,
      shiftId: shift.id,
      metadata: { inventoryItemId: item.id, quantityDelta },
    });
    return {
      id: input.adjustmentId,
      shiftId: shift.id,
      status: "pending" as const,
      quantityDelta: databaseQuantity(quantityDelta),
      idempotent: false,
    };
  });
}

export async function reviewInventoryAdjustment(
  input:
    | {
        adjustmentId: string;
        inventoryEventId: string;
        decision: "approved";
      }
    | {
        adjustmentId: string;
        inventoryEventId?: string;
        decision: "rejected";
      },
) {
  const access = await requireActiveBusiness({ admin: true });
  return requireDatabase().transaction(async (tx) => {
    const [adjustment] = await tx
      .select({
        id: inventoryAdjustments.id,
        shiftId: inventoryAdjustments.shiftId,
        inventoryLocationId: inventoryAdjustments.inventoryLocationId,
        inventoryItemId: inventoryAdjustments.inventoryItemId,
        quantityDelta: inventoryAdjustments.quantityDelta,
        reason: inventoryAdjustments.reason,
        status: inventoryAdjustments.status,
      })
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.id, input.adjustmentId),
          eq(inventoryAdjustments.businessId, access.business.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!adjustment) throw new AccessError("Inventory adjustment not found.");
    if (
      (input.decision === "approved" && adjustment.status === "applied") ||
      (input.decision === "rejected" && adjustment.status === "rejected")
    ) {
      return { ...adjustment, idempotent: true };
    }
    if (adjustment.status !== "pending" || !adjustment.shiftId) {
      throw new AccessError("This shift adjustment cannot be reviewed.");
    }

    const [shift] = await tx
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, adjustment.shiftId),
          eq(shifts.businessId, access.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!shift || (shift.status !== "active" && shift.status !== "closing")) {
      throw new AccessError("The shift is no longer open for review.");
    }
    const [location] = await tx
      .select({ id: inventoryLocations.id })
      .from(inventoryLocations)
      .where(
        and(
          eq(inventoryLocations.id, adjustment.inventoryLocationId),
          eq(inventoryLocations.businessId, access.business.id),
          eq(inventoryLocations.shiftId, shift.id),
          eq(inventoryLocations.status, "active"),
          isNull(inventoryLocations.deletedAt),
        ),
      )
      .limit(1);
    const [item] = await tx
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, adjustment.inventoryItemId),
          eq(inventoryItems.businessId, access.business.id),
          eq(inventoryItems.status, "active"),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .limit(1);
    if (!location || !item) {
      throw new AccessError("The adjustment inventory linkage is invalid.");
    }

    const reviewedAt = new Date();
    const status = input.decision === "approved" ? "applied" : "rejected";
    if (input.decision === "approved") {
      await applyInventoryDeltas(tx, {
        businessId: access.business.id,
        shiftId: shift.id,
        inventoryLocationId: location.id,
        eventId: input.inventoryEventId,
        eventType: "adjustment",
        sourceType: "inventory_adjustment",
        sourceId: adjustment.id,
        employeeId: access.employee?.id ?? null,
        notes: adjustment.reason,
        lines: [
          {
            inventoryItemId: item.id,
            quantityDelta: adjustment.quantityDelta,
          },
        ],
      });
    }
    const [reviewed] = await tx
      .update(inventoryAdjustments)
      .set({
        status,
        reviewedBy: access.employee?.id ?? null,
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(
        and(
          eq(inventoryAdjustments.id, adjustment.id),
          eq(inventoryAdjustments.businessId, access.business.id),
          eq(inventoryAdjustments.status, "pending"),
        ),
      )
      .returning({ id: inventoryAdjustments.id });
    if (!reviewed) throw new AccessError("The adjustment review conflicted.");

    await insertAuditLog(tx, access, {
      action: `inventory_adjustment.${status}`,
      entityType: "inventory_adjustment",
      entityId: adjustment.id,
      shiftId: shift.id,
      metadata: {
        inventoryItemId: item.id,
        quantityDelta: adjustment.quantityDelta,
        inventoryEventId:
          input.decision === "approved" ? input.inventoryEventId : null,
      },
    });
    return { ...adjustment, status, idempotent: false };
  });
}
