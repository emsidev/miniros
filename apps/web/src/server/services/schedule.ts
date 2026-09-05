import { requireDatabase } from "@miniros/db";
import {
  offlineShiftSessions,
  sellingLocations,
  shiftAssignments,
  shifts,
} from "@miniros/db/schema";
import { and, asc, eq, isNull, inArray, sql } from "drizzle-orm";
import {
  isAssigned,
  joinEligibility,
  publishedShiftStatuses,
  type ScheduleShift,
} from "@/lib/schedule";
import { manilaToday } from "@/lib/shift-planning";
import { isProductionOnlyEmployee, requireActiveBusiness } from "./access";
import { AccessError } from "./access-error";

/** Only calendar fields leave this service. Operational details remain assigned-only. */
export async function listScheduleShifts(): Promise<ScheduleShift[]> {
  const { business, employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee))
    throw new AccessError(
      "Schedule is unavailable for production-only employees.",
    );
  const rows = await requireDatabase()
    .select({
      id: shifts.id,
      title: shifts.title,
      shiftDate: shifts.shiftDate,
      status: shifts.status,
      locationName: sellingLocations.name,
      actualStartAt: shifts.actualStartAt,
      scheduledStartAt: shifts.scheduledStartAt,
      assignmentStatus: shiftAssignments.status,
      reserved: sql<boolean>`exists (select 1 from ${offlineShiftSessions} s where s.business_id = ${shifts.businessId} and s.shift_id = ${shifts.id} and s.status not in ('closed', 'released'))`,
    })
    .from(shifts)
    .innerJoin(
      sellingLocations,
      and(
        eq(sellingLocations.id, shifts.sellingLocationId),
        eq(sellingLocations.businessId, business.id),
      ),
    )
    .leftJoin(
      shiftAssignments,
      and(
        eq(shiftAssignments.shiftId, shifts.id),
        eq(shiftAssignments.businessId, business.id),
        employee ? eq(shiftAssignments.employeeId, employee.id) : sql`false`,
      ),
    )
    .where(
      and(
        eq(shifts.businessId, business.id),
        isNull(shifts.deletedAt),
        inArray(shifts.status, [...publishedShiftStatuses]),
      ),
    )
    .orderBy(asc(shifts.shiftDate), asc(shifts.createdAt), asc(shifts.id));
  const occupiedDates = new Set(
    rows
      .filter((row) => isAssigned(row.assignmentStatus))
      .map((row) => row.shiftDate),
  );
  const now = new Date();
  const today = manilaToday(now);
  return rows.map((row) => {
    const assigned = isAssigned(row.assignmentStatus);
    const conflict = !assigned && occupiedDates.has(row.shiftDate);
    return {
      id: row.id,
      title: row.title,
      shiftDate: row.shiftDate,
      status: row.status,
      locationName: row.locationName,
      assignmentStatus: row.assignmentStatus,
      assigned,
      conflict,
      ...joinEligibility(row, {
        assigned,
        conflict,
        reserved: row.reserved,
        employeeEligible: Boolean(employee),
        today,
        now,
      }),
    };
  });
}
