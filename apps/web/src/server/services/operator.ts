import { requireDatabase } from "@miniros/db";
import {
  employees,
  sellingLocations,
  shiftAssignments,
  shiftProfitSummaries,
  shifts,
} from "@miniros/db/schema";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";

export async function listAssignedShifts() {
  const { business, employee } = await requireActiveBusiness();
  if (!employee)
    throw new AccessError("An active employee record is required.");

  return requireDatabase()
    .select({
      id: shifts.id,
      title: shifts.title,
      shiftDate: shifts.shiftDate,
      scheduledStartAt: shifts.scheduledStartAt,
      scheduledEndAt: shifts.scheduledEndAt,
      actualStartAt: shifts.actualStartAt,
      actualEndAt: shifts.actualEndAt,
      status: shifts.status,
      notes: shifts.notes,
      locationName: sellingLocations.name,
      roleOnShift: shiftAssignments.roleOnShift,
      assignmentStatus: shiftAssignments.status,
      profitCents: shiftProfitSummaries.profitCents,
      profitResult: shiftProfitSummaries.result,
    })
    .from(shiftAssignments)
    .innerJoin(
      shifts,
      and(
        eq(shifts.id, shiftAssignments.shiftId),
        eq(shifts.businessId, shiftAssignments.businessId),
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
    .where(
      and(
        eq(shiftAssignments.businessId, business.id),
        eq(shiftAssignments.employeeId, employee.id),
        inArray(shiftAssignments.status, [
          "assigned",
          "confirmed",
          "completed",
        ]),
        isNull(shifts.deletedAt),
      ),
    )
    .orderBy(desc(shifts.shiftDate), asc(shifts.scheduledStartAt));
}

export async function getAssignedShift(shiftId: string) {
  const context = await requireActiveBusiness({ assignedShiftId: shiftId });
  if (!context.employee) {
    throw new AccessError("An active employee record is required.");
  }

  const [shift] = (await listAssignedShifts()).filter(
    (candidate) => candidate.id === shiftId,
  );
  if (!shift) throw new AccessError("Assigned shift not found.");

  const teammates = await requireDatabase()
    .select({
      employeeId: employees.id,
      name: employees.displayName,
      roleOnShift: shiftAssignments.roleOnShift,
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
        eq(shiftAssignments.businessId, context.business.id),
        eq(shiftAssignments.shiftId, shiftId),
      ),
    );

  return { ...shift, teammates, permissions: context.employee };
}
