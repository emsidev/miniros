import { requireDatabase } from "@miniros/db";
import {
  cashDeductions,
  cashReconciliations,
  inventoryAdjustments,
  inventoryEventLines,
  inventoryEvents,
  inventoryItems,
  offlineShiftSessions,
  sellingLocations,
  shiftCloseouts,
  shiftProfitSummaries,
  shifts,
} from "@miniros/db/schema";
import { and, eq, gte, lte, isNull, desc } from "drizzle-orm";
import { requireActiveBusiness } from "./access";
import type { SalesReportFilters } from "./sales-reports";
export async function getShiftReportStatus(filters: SalesReportFilters = {}) {
  const { business } = await requireActiveBusiness({ admin: true }),
    db = requireDatabase();
  const dateScope = [
    filters.from ? gte(shifts.shiftDate, filters.from) : undefined,
    filters.to ? lte(shifts.shiftDate, filters.to) : undefined,
  ];
  const rows = await db
    .select({
      id: shifts.id,
      date: shifts.shiftDate,
      status: shifts.status,
      location: sellingLocations.name,
      salesCents: shiftProfitSummaries.netSalesCents,
      productCostCents: shiftProfitSummaries.productCostCents,
      wagesCents: shiftProfitSummaries.salaryCostCents,
      rentCents: shiftProfitSummaries.rentalCostCents,
      transportCents: shiftProfitSummaries.transportCostCents,
      expensesCents: shiftProfitSummaries.approvedDeductionsCents,
      otherCostsCents: shiftProfitSummaries.otherCostsCents,
      profitCents: shiftProfitSummaries.profitCents,
      closeoutStatus: shiftCloseouts.status,
      cashDifferenceCents: cashReconciliations.cashDifferenceCents,
      expectedCashCents: cashReconciliations.expectedCashCents,
      actualCashCents: cashReconciliations.actualCashCents,
    })
    .from(shifts)
    .innerJoin(
      sellingLocations,
      and(
        eq(sellingLocations.id, shifts.sellingLocationId),
        eq(sellingLocations.businessId, shifts.businessId),
      ),
    )
    .leftJoin(
      shiftProfitSummaries,
      and(
        eq(shiftProfitSummaries.shiftId, shifts.id),
        eq(shiftProfitSummaries.businessId, shifts.businessId),
      ),
    )
    .leftJoin(
      shiftCloseouts,
      and(
        eq(shiftCloseouts.shiftId, shifts.id),
        eq(shiftCloseouts.businessId, shifts.businessId),
      ),
    )
    .leftJoin(
      cashReconciliations,
      and(
        eq(cashReconciliations.closeoutId, shiftCloseouts.id),
        eq(cashReconciliations.businessId, shifts.businessId),
      ),
    )
    .where(
      and(
        eq(shifts.businessId, business.id),
        isNull(shifts.deletedAt),
        ...dateScope,
      ),
    )
    .orderBy(desc(shifts.shiftDate));
  const [sessions, cash, stock, differences] = await Promise.all([
    db
      .select({
        shiftId: offlineShiftSessions.shiftId,
        status: offlineShiftSessions.status,
        sequence: offlineShiftSessions.acknowledgedSequence,
        error: offlineShiftSessions.lastError,
      })
      .from(offlineShiftSessions)
      .where(eq(offlineShiftSessions.businessId, business.id)),
    db
      .select({ shiftId: cashDeductions.shiftId })
      .from(cashDeductions)
      .where(
        and(
          eq(cashDeductions.businessId, business.id),
          eq(cashDeductions.status, "pending"),
        ),
      ),
    db
      .select({ shiftId: inventoryAdjustments.shiftId })
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.businessId, business.id),
          eq(inventoryAdjustments.status, "pending"),
        ),
      ),
    db
      .select({
        shiftId: inventoryEvents.shiftId,
        name: inventoryItems.name,
        unit: inventoryEventLines.unit,
        difference: inventoryEventLines.quantityDelta,
        actual: inventoryEventLines.balanceAfter,
      })
      .from(inventoryEventLines)
      .innerJoin(
        inventoryEvents,
        and(
          eq(inventoryEvents.id, inventoryEventLines.eventId),
          eq(inventoryEvents.businessId, inventoryEventLines.businessId),
        ),
      )
      .innerJoin(
        inventoryItems,
        and(
          eq(inventoryItems.id, inventoryEventLines.inventoryItemId),
          eq(inventoryItems.businessId, inventoryEventLines.businessId),
        ),
      )
      .where(
        and(
          eq(inventoryEventLines.businessId, business.id),
          eq(inventoryEvents.eventType, "closeout_count"),
        ),
      ),
  ]);
  return rows.map((row) => ({
    ...row,
    sessions: sessions.filter(
      (s) => s.shiftId === row.id && s.status !== "released",
    ),
    pendingReviews:
      cash.filter((r) => r.shiftId === row.id).length +
      stock.filter((r) => r.shiftId === row.id).length +
      (row.closeoutStatus === "submitted" && business.features.approvalsEnabled
        ? 1
        : 0),
    stockDifferences: differences.filter((d) => d.shiftId === row.id),
  }));
}
