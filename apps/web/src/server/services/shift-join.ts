import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  businessMembers,
  businesses,
  employees,
  shiftAssignments,
  shifts,
} from "@miniros/db/schema";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import {
  assignedStatuses,
  isAssigned,
  joinEligibility,
  publishedShiftStatuses,
} from "@/lib/schedule";
import { manilaToday } from "@/lib/shift-planning";
import { isProductionOnlyEmployee, requireActiveBusiness } from "./access";
import { AccessError } from "./access-error";
import type { ShiftTransaction } from "./admin-shift-persistence";
import { assertUnreservedShift, lockShift } from "./offline-context";
import { lockBusinessSchedule } from "./schedule-lock";

/** Internal actor comes only from authenticated server context, never action input. */
export async function joinShiftInTransaction(
  tx: ShiftTransaction,
  actor: { businessId: string; userId: string; employeeId: string },
  shiftId: string,
) {
  await lockBusinessSchedule(tx, actor.businessId);
  const shift = await lockShift(tx, actor.businessId, shiftId);
  const [person] = await tx
    .select({ employee: employees })
    .from(employees)
    .innerJoin(
      businessMembers,
      and(
        eq(businessMembers.id, employees.memberId),
        eq(businessMembers.businessId, employees.businessId),
      ),
    )
    .innerJoin(businesses, eq(businesses.id, employees.businessId))
    .where(
      and(
        eq(employees.id, actor.employeeId),
        eq(employees.businessId, actor.businessId),
        eq(employees.status, "active"),
        isNull(employees.deletedAt),
        eq(businessMembers.authUserId, actor.userId),
        eq(businessMembers.status, "active"),
        isNull(businessMembers.deletedAt),
        eq(businesses.status, "active"),
        isNull(businesses.deletedAt),
      ),
    )
    .for("share");
  if (!person || isProductionOnlyEmployee(person.employee))
    throw new AccessError("An eligible employee record is required to join.");
  const [existing] = await tx
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.businessId, actor.businessId),
        eq(shiftAssignments.shiftId, shiftId),
        eq(shiftAssignments.employeeId, actor.employeeId),
      ),
    );
  // A retry never changes an existing assignment's status, role, pay, or audit trail.
  if (
    existing &&
    isAssigned(existing.status) &&
    publishedShiftStatuses.some((status) => status === shift.status)
  )
    return { shiftId, assignmentId: existing.id, alreadyAssigned: true };
  const [conflict] = await tx
    .select({ id: shiftAssignments.id })
    .from(shiftAssignments)
    .innerJoin(
      shifts,
      and(
        eq(shifts.id, shiftAssignments.shiftId),
        eq(shifts.businessId, shiftAssignments.businessId),
      ),
    )
    .where(
      and(
        eq(shiftAssignments.businessId, actor.businessId),
        eq(shiftAssignments.employeeId, actor.employeeId),
        ne(shifts.id, shiftId),
        eq(shifts.shiftDate, shift.shiftDate),
        inArray(shiftAssignments.status, [...assignedStatuses]),
        inArray(shifts.status, [...publishedShiftStatuses]),
        isNull(shifts.deletedAt),
      ),
    )
    .limit(1);
  const now = new Date();
  const eligibility = joinEligibility(shift, {
    assigned: false,
    conflict: Boolean(conflict),
    reserved: false,
    employeeEligible: true,
    today: manilaToday(now),
    now,
  });
  if (!eligibility.canJoin) throw new AccessError(eligibility.reason!);
  await assertUnreservedShift(tx, actor.businessId, shiftId);
  const assignmentId = existing?.id ?? randomUUID();
  const snapshot = {
    status: "assigned" as const,
    salaryRateCents: person.employee.defaultShiftRateCents,
    roleOnShift: person.employee.canUsePos
      ? ("operator" as const)
      : ("employee" as const),
    updatedAt: now,
  };
  if (existing)
    await tx
      .update(shiftAssignments)
      .set(snapshot)
      .where(
        and(
          eq(shiftAssignments.id, existing.id),
          eq(shiftAssignments.businessId, actor.businessId),
        ),
      );
  else
    await tx.insert(shiftAssignments).values({
      id: assignmentId,
      businessId: actor.businessId,
      employeeId: actor.employeeId,
      shiftId,
      ...snapshot,
    });
  await tx
    .update(shifts)
    .set({
      updatedAt: new Date(Math.max(Date.now(), shift.updatedAt.getTime() + 1)),
    })
    .where(
      and(eq(shifts.id, shiftId), eq(shifts.businessId, actor.businessId)),
    );
  await tx.insert(auditLogs).values({
    id: randomUUID(),
    businessId: actor.businessId,
    actorUserId: actor.userId,
    actorEmployeeId: actor.employeeId,
    action: "shift.joined",
    entityType: "shift",
    entityId: shiftId,
    shiftId,
    metadata: {
      assignmentId,
      reactivated: Boolean(existing),
      roleOnShift: snapshot.roleOnShift,
      salaryRateCents: snapshot.salaryRateCents,
    },
  });
  return { shiftId, assignmentId, alreadyAssigned: false };
}

export async function joinShift(shiftId: string) {
  const { business, employee, user } = await requireActiveBusiness();
  if (!employee || isProductionOnlyEmployee(employee))
    throw new AccessError("An eligible employee record is required to join.");
  return requireDatabase().transaction((tx) =>
    joinShiftInTransaction(
      tx,
      { businessId: business.id, employeeId: employee.id, userId: user.id },
      shiftId,
    ),
  );
}
