import { requireDatabase } from "@miniros/db";
import {
  cashDeductions,
  inventoryAdjustments,
  sellingLocations,
  shiftAssignments,
  shiftCloseouts,
  shiftProfitSummaries,
  shifts,
  employees,
} from "@miniros/db/schema";
import { calculateLocationProfitability } from "@miniros/domain";
import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { z } from "zod";

import { AccessError, requireActiveBusiness } from "./access";

function manilaDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const reportFiltersSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  locationId: z.string().uuid().optional(),
});

export type ProfitabilityFilters = z.infer<typeof reportFiltersSchema>;

export async function listLocationProfitability(
  rawFilters: ProfitabilityFilters = {},
) {
  const filters = reportFiltersSchema.parse(rawFilters);
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  const [locations, summaries] = await Promise.all([
    database
      .select({ id: sellingLocations.id, name: sellingLocations.name })
      .from(sellingLocations)
      .where(
        and(
          eq(sellingLocations.businessId, business.id),
          eq(sellingLocations.status, "active"),
          isNull(sellingLocations.deletedAt),
          filters.locationId
            ? eq(sellingLocations.id, filters.locationId)
            : undefined,
        ),
      )
      .orderBy(asc(sellingLocations.name)),
    database
      .select({
        locationId: shiftProfitSummaries.sellingLocationId,
        shiftId: shiftProfitSummaries.shiftId,
        grossSalesCents: shiftProfitSummaries.grossSalesCents,
        totalCostsCents: shiftProfitSummaries.totalCostsCents,
        closedAt: shifts.actualEndAt,
        shiftDate: shifts.shiftDate,
      })
      .from(shiftProfitSummaries)
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, shiftProfitSummaries.shiftId),
          eq(shifts.businessId, shiftProfitSummaries.businessId),
        ),
      )
      .where(
        and(
          eq(shiftProfitSummaries.businessId, business.id),
          eq(shifts.businessId, business.id),
          eq(shifts.status, "closed"),
          isNull(shifts.deletedAt),
          filters.locationId
            ? eq(shiftProfitSummaries.sellingLocationId, filters.locationId)
            : undefined,
          filters.from ? gte(shifts.shiftDate, filters.from) : undefined,
          filters.to ? lte(shifts.shiftDate, filters.to) : undefined,
        ),
      ),
  ]);

  return locations.map((location) => {
    const summary = calculateLocationProfitability({
      locationId: location.id,
      shifts: summaries
        .filter((row) => row.locationId === location.id)
        .map((row) => ({
          shiftId: row.shiftId,
          closedAt: row.closedAt ?? new Date(`${row.shiftDate}T23:59:59+08:00`),
          grossSalesCents: row.grossSalesCents,
          totalCostsCents: row.totalCostsCents,
        })),
    });

    return { ...summary, locationName: location.name };
  });
}

export async function getAdminDashboard() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const today = manilaDate();

  const [
    todayProfitRows,
    activeShiftRows,
    pendingCash,
    pendingInventory,
    recent,
  ] = await Promise.all([
    database
      .select({
        grossSalesCents: shiftProfitSummaries.grossSalesCents,
        profitCents: shiftProfitSummaries.profitCents,
      })
      .from(shiftProfitSummaries)
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, shiftProfitSummaries.shiftId),
          eq(shifts.businessId, shiftProfitSummaries.businessId),
        ),
      )
      .where(
        and(
          eq(shiftProfitSummaries.businessId, business.id),
          eq(shifts.businessId, business.id),
          eq(shifts.shiftDate, today),
        ),
      ),
    database
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.businessId, business.id),
          inArray(shifts.status, ["active", "closing"]),
          isNull(shifts.deletedAt),
        ),
      ),
    database
      .select({ id: cashDeductions.id })
      .from(cashDeductions)
      .where(
        and(
          eq(cashDeductions.businessId, business.id),
          eq(cashDeductions.status, "pending"),
        ),
      ),
    database
      .select({ id: inventoryAdjustments.id })
      .from(inventoryAdjustments)
      .where(
        and(
          eq(inventoryAdjustments.businessId, business.id),
          eq(inventoryAdjustments.status, "pending"),
        ),
      ),
    database
      .select({
        closeoutId: shiftCloseouts.id,
        shiftId: shifts.id,
        shiftDate: shifts.shiftDate,
        locationName: sellingLocations.name,
        profitCents: shiftProfitSummaries.profitCents,
        result: shiftProfitSummaries.result,
      })
      .from(shiftCloseouts)
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, shiftCloseouts.shiftId),
          eq(shifts.businessId, shiftCloseouts.businessId),
        ),
      )
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
      .where(eq(shiftCloseouts.businessId, business.id))
      .orderBy(desc(shiftCloseouts.submittedAt))
      .limit(5),
  ]);

  const locations = await listLocationProfitability();
  const ranked = locations
    .filter((location) => location.totalShifts > 0)
    .sort((left, right) => right.netProfitCents - left.netProfitCents);

  return {
    business,
    todayGrossSalesCents: todayProfitRows.reduce(
      (total, row) => total + row.grossSalesCents,
      0,
    ),
    todayProfitCents: todayProfitRows.reduce(
      (total, row) => total + row.profitCents,
      0,
    ),
    activeShiftCount: activeShiftRows.length,
    pendingApprovalCount: pendingCash.length + pendingInventory.length,
    bestLocation: ranked[0] ?? null,
    worstLocation: ranked.at(-1) ?? null,
    recentCloseouts: recent,
  };
}

export async function getAdminShiftDetail(shiftId: string) {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const [shift] = await database
    .select({
      id: shifts.id,
      title: shifts.title,
      shiftDate: shifts.shiftDate,
      actualStartAt: shifts.actualStartAt,
      actualEndAt: shifts.actualEndAt,
      status: shifts.status,
      notes: shifts.notes,
      locationId: sellingLocations.id,
      locationName: sellingLocations.name,
      profitCents: shiftProfitSummaries.profitCents,
      result: shiftProfitSummaries.result,
      grossSalesCents: shiftProfitSummaries.grossSalesCents,
      productCostCents: shiftProfitSummaries.productCostCents,
      totalCostsCents: shiftProfitSummaries.totalCostsCents,
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
    .where(
      and(
        eq(shifts.id, shiftId),
        eq(shifts.businessId, business.id),
        isNull(shifts.deletedAt),
      ),
    )
    .limit(1);

  if (!shift) throw new AccessError("Shift not found in the active business.");

  const assignments = await database
    .select({
      id: shiftAssignments.id,
      employeeId: employees.id,
      employeeName: employees.displayName,
      roleOnShift: shiftAssignments.roleOnShift,
      salaryRateCents: shiftAssignments.salaryRateCents,
      status: shiftAssignments.status,
    })
    .from(shiftAssignments)
    .innerJoin(
      employees,
      and(
        eq(employees.id, shiftAssignments.employeeId),
        eq(employees.businessId, shiftAssignments.businessId),
      ),
    )
    .where(
      and(
        eq(shiftAssignments.businessId, business.id),
        eq(shiftAssignments.shiftId, shiftId),
      ),
    )
    .orderBy(asc(employees.displayName));

  return { ...shift, assignments };
}
