import { requireDatabase } from "@miniros/db";
import {
  cashReconciliations,
  inventoryBalances,
  shiftAssignments,
  shiftCloseouts,
  shiftInventoryCounts,
  shiftProfitSummaries,
  shifts,
} from "@miniros/db/schema";
import { assertNonNegativeCents, subtractCents } from "@miniros/domain";
import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import { aggregateCloseoutFinancials } from "./closeout-aggregates";
import { setInventoryCounts } from "./inventory-counts";
import {
  getShiftInventoryLocation,
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
  type OperationalTransaction,
} from "./operational-helpers";

export type SubmitShiftCloseoutInput = {
  closeoutId: string;
  cashReconciliationId: string;
  profitSummaryId: string;
  inventoryEventId: string;
  shiftId: string;
  actualCashCents: number;
  counts: readonly {
    inventoryItemId: string;
    quantity: number | string;
  }[];
  notes?: string | null;
};

async function findExistingCloseout(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
  closeoutId: string,
) {
  const [existing] = await tx
    .select({
      id: shiftCloseouts.id,
      shiftId: shiftCloseouts.shiftId,
      status: shiftCloseouts.status,
      actualCashCents: cashReconciliations.actualCashCents,
      expectedCashCents: cashReconciliations.expectedCashCents,
      cashDifferenceCents: cashReconciliations.cashDifferenceCents,
      profitCents: shiftProfitSummaries.profitCents,
      profitResult: shiftProfitSummaries.result,
    })
    .from(shiftCloseouts)
    .leftJoin(
      cashReconciliations,
      and(
        eq(cashReconciliations.closeoutId, shiftCloseouts.id),
        eq(cashReconciliations.businessId, shiftCloseouts.businessId),
      ),
    )
    .leftJoin(
      shiftProfitSummaries,
      and(
        eq(shiftProfitSummaries.shiftId, shiftCloseouts.shiftId),
        eq(shiftProfitSummaries.businessId, shiftCloseouts.businessId),
      ),
    )
    .where(
      and(
        eq(shiftCloseouts.businessId, businessId),
        or(
          eq(shiftCloseouts.id, closeoutId),
          eq(shiftCloseouts.clientGeneratedId, closeoutId),
          eq(shiftCloseouts.shiftId, shiftId),
        ),
      ),
    )
    .limit(1);
  if (existing && existing.shiftId !== shiftId) {
    throw new AccessError("The closeout request ID is already in use.");
  }
  return existing;
}

export async function submitShiftCloseout(input: SubmitShiftCloseoutInput) {
  const access = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: input.shiftId,
  });
  requireEmployee(access);
  assertNonNegativeCents(input.actualCashCents, "actualCashCents");

  return requireDatabase().transaction(async (tx) => {
    const existing = await findExistingCloseout(
      tx,
      access.business.id,
      input.shiftId,
      input.closeoutId,
    );
    if (existing) return { ...existing, idempotent: true };

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
    if (shift.status === "closed") {
      const raced = await findExistingCloseout(
        tx,
        access.business.id,
        input.shiftId,
        input.closeoutId,
      );
      if (raced) return { ...raced, idempotent: true };
    }
    if (shift.status !== "active" && shift.status !== "closing") {
      throw new AccessError("Only an open shift can be closed.");
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

    const balanceItems = await tx
      .select({ id: inventoryBalances.inventoryItemId })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.businessId, access.business.id),
          eq(inventoryBalances.inventoryLocationId, inventoryLocation.id),
        ),
      );
    const openingItems = await tx
      .select({ id: shiftInventoryCounts.inventoryItemId })
      .from(shiftInventoryCounts)
      .where(
        and(
          eq(shiftInventoryCounts.businessId, access.business.id),
          eq(shiftInventoryCounts.shiftId, shift.id),
          eq(shiftInventoryCounts.countType, "opening"),
        ),
      );
    const providedIds = new Set(
      input.counts.map((count) => count.inventoryItemId),
    );
    const missingCount = [...balanceItems, ...openingItems].some(
      (item) => !providedIds.has(item.id),
    );
    if (input.counts.length === 0 || missingCount) {
      throw new AccessError("Closing counts must cover every shift item.");
    }

    const { summary, expectedCashCents } = await aggregateCloseoutFinancials(
      tx,
      access.business.id,
      shift.id,
    );
    const cashDifferenceCents = subtractCents(
      input.actualCashCents,
      expectedCashCents,
    );

    await tx.insert(shiftCloseouts).values({
      id: input.closeoutId,
      businessId: access.business.id,
      shiftId: shift.id,
      status: "submitted",
      submittedBy: access.employee.id,
      notes: input.notes?.trim() || null,
      clientGeneratedId: input.closeoutId,
    });
    await setInventoryCounts(tx, {
      businessId: access.business.id,
      shiftId: shift.id,
      inventoryLocationId: inventoryLocation.id,
      eventId: input.inventoryEventId,
      countType: "closing",
      employeeId: access.employee.id,
      notes: input.notes,
      counts: input.counts,
    });
    await tx.insert(cashReconciliations).values({
      id: input.cashReconciliationId,
      businessId: access.business.id,
      closeoutId: input.closeoutId,
      expectedCashCents,
      actualCashCents: input.actualCashCents,
      cashDifferenceCents,
      notes: input.notes?.trim() || null,
    });
    await tx.insert(shiftProfitSummaries).values({
      id: input.profitSummaryId,
      businessId: access.business.id,
      shiftId: shift.id,
      sellingLocationId: shift.sellingLocationId,
      ...summary,
    });

    const closedAt = new Date();
    const [closed] = await tx
      .update(shifts)
      .set({
        status: "closed",
        actualEndAt: closedAt,
        closedBy: access.employee.id,
        updatedAt: closedAt,
      })
      .where(
        and(
          eq(shifts.id, shift.id),
          eq(shifts.businessId, access.business.id),
          inArray(shifts.status, ["active", "closing"]),
        ),
      )
      .returning({ id: shifts.id });
    if (!closed) throw new AccessError("The shift closeout conflicted.");
    await tx
      .update(shiftAssignments)
      .set({ status: "completed", updatedAt: closedAt })
      .where(
        and(
          eq(shiftAssignments.businessId, access.business.id),
          eq(shiftAssignments.shiftId, shift.id),
          inArray(shiftAssignments.status, ["assigned", "confirmed"]),
        ),
      );
    await insertAuditLog(tx, access, {
      action: "shift.closeout_submitted",
      entityType: "shift_closeout",
      entityId: input.closeoutId,
      shiftId: shift.id,
      metadata: {
        inventoryEventId: input.inventoryEventId,
        expectedCashCents,
        actualCashCents: input.actualCashCents,
        cashDifferenceCents,
        profitCents: summary.profitCents,
        profitResult: summary.result,
      },
    });
    return {
      id: input.closeoutId,
      shiftId: shift.id,
      status: "submitted" as const,
      expectedCashCents,
      actualCashCents: input.actualCashCents,
      cashDifferenceCents,
      profitCents: summary.profitCents,
      profitResult: summary.result,
      idempotent: false,
    };
  });
}
