import type { Database } from "@miniros/db";
import {
  employees,
  shiftAssignments,
  shiftCosts,
  shifts,
} from "@miniros/db/schema";
import { sumCents } from "@miniros/domain";
import { and, asc, eq, inArray } from "drizzle-orm";

function shiftDto(
  row: typeof shifts.$inferSelect,
  locationName: string,
  assignments: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    roleOnShift: (typeof shiftAssignments.$inferSelect)["roleOnShift"];
    salaryRateCents: number;
    status: (typeof shiftAssignments.$inferSelect)["status"];
  }>,
  costs: Array<{
    id: string;
    costType: (typeof shiftCosts.$inferSelect)["costType"];
    label: string;
    amountCents: number;
    notes: string | null;
  }>,
) {
  const rentalCostCents = costs
    .filter((cost) => cost.costType === "rent")
    .reduce((total, cost) => sumCents(total, cost.amountCents), 0);
  const transportCostCents = costs
    .filter((cost) => cost.costType === "transport")
    .reduce((total, cost) => sumCents(total, cost.amountCents), 0);
  const otherCostCents = costs
    .filter((cost) => cost.costType === "other")
    .reduce((total, cost) => sumCents(total, cost.amountCents), 0);

  return {
    id: row.id,
    sellingLocationId: row.sellingLocationId,
    locationName,
    title: row.title,
    shiftDate: row.shiftDate,
    scheduledStartAt: row.scheduledStartAt?.toISOString() ?? null,
    scheduledEndAt: row.scheduledEndAt?.toISOString() ?? null,
    actualStartAt: row.actualStartAt?.toISOString() ?? null,
    actualEndAt: row.actualEndAt?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    rentalCostCents,
    transportCostCents,
    otherCostCents,
    totalExpectedCostCents: sumCents(
      rentalCostCents,
      transportCostCents,
      otherCostCents,
    ),
    assignments,
    costs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function readShiftDetails(
  database: Database,
  businessId: string,
  shiftRows: Array<{
    shift: typeof shifts.$inferSelect;
    locationName: string;
  }>,
) {
  const shiftIds = shiftRows.map(({ shift }) => shift.id);
  if (!shiftIds.length) return [];

  const [assignmentRows, costRows] = await Promise.all([
    database
      .select({
        id: shiftAssignments.id,
        shiftId: shiftAssignments.shiftId,
        employeeId: shiftAssignments.employeeId,
        employeeName: employees.displayName,
        roleOnShift: shiftAssignments.roleOnShift,
        salaryRateCents: shiftAssignments.salaryRateCents,
        status: shiftAssignments.status,
      })
      .from(shiftAssignments)
      .innerJoin(
        employees,
        and(
          eq(shiftAssignments.employeeId, employees.id),
          eq(employees.businessId, businessId),
        ),
      )
      .where(
        and(
          eq(shiftAssignments.businessId, businessId),
          inArray(shiftAssignments.shiftId, shiftIds),
        ),
      )
      .orderBy(asc(employees.displayName)),
    database
      .select({
        id: shiftCosts.id,
        shiftId: shiftCosts.shiftId,
        costType: shiftCosts.costType,
        label: shiftCosts.label,
        amountCents: shiftCosts.amountCents,
        notes: shiftCosts.notes,
      })
      .from(shiftCosts)
      .where(
        and(
          eq(shiftCosts.businessId, businessId),
          inArray(shiftCosts.shiftId, shiftIds),
        ),
      ),
  ]);

  return shiftRows.map(({ shift, locationName }) =>
    shiftDto(
      shift,
      locationName,
      assignmentRows
        .filter((item) => item.shiftId === shift.id)
        .map((item) => ({
          id: item.id,
          employeeId: item.employeeId,
          employeeName: item.employeeName,
          roleOnShift: item.roleOnShift,
          salaryRateCents: item.salaryRateCents,
          status: item.status,
        })),
      costRows
        .filter((item) => item.shiftId === shift.id)
        .map((item) => ({
          id: item.id,
          costType: item.costType,
          label: item.label,
          amountCents: item.amountCents,
          notes: item.notes,
        })),
    ),
  );
}
