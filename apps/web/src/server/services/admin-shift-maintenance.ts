import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { auditLogs, shiftAssignments, shifts } from "@miniros/db/schema";
import { and, eq, isNull } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import {
  requireScopedAssignments,
  replaceAssignments,
} from "./admin-shift-persistence";
import {
  assertAssignments,
  type ShiftAssignmentInput,
} from "./admin-shift-types";

export async function replaceAdminShiftAssignments(
  shiftId: string,
  assignments: ShiftAssignmentInput[],
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  assertAssignments(assignments);

  await database.transaction(async (tx) => {
    const [shift] = await tx
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, shiftId),
          eq(shifts.businessId, access.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .limit(1);
    if (!shift) throw new AccessError("Shift not found.");
    if (shift.status !== "scheduled") {
      throw new AccessError(
        "Assignments can change only before a shift starts.",
      );
    }

    await requireScopedAssignments(tx, access.business.id, assignments);
    await replaceAssignments(
      tx,
      access.business.id,
      shiftId,
      assignments,
      false,
    );
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "shift.assignments_replaced",
      entityType: "shift",
      entityId: shiftId,
      shiftId,
      metadata: { employeeIds: assignments.map((item) => item.employeeId) },
    });
  });

  const { listAdminShifts } = await import("./admin-shifts");
  const updated = (await listAdminShifts()).find(
    (shift) => shift.id === shiftId,
  );
  if (!updated) throw new Error("Updated shift could not be read.");
  return updated;
}

export async function softDeleteAdminShift(shiftId: string) {
  const access = await requireActiveBusiness({ admin: true });
  return requireDatabase().transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: shifts.id, status: shifts.status, title: shifts.title })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, shiftId),
          eq(shifts.businessId, access.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .limit(1);
    if (!existing) throw new AccessError("Shift not found.");
    if (existing.status !== "scheduled" && existing.status !== "cancelled") {
      throw new AccessError("An active or closed shift cannot be deleted.");
    }

    const deletedAt = new Date();
    await tx
      .update(shifts)
      .set({ status: "cancelled", deletedAt, updatedAt: deletedAt })
      .where(
        and(eq(shifts.id, shiftId), eq(shifts.businessId, access.business.id)),
      );
    await tx
      .update(shiftAssignments)
      .set({ status: "cancelled", updatedAt: deletedAt })
      .where(
        and(
          eq(shiftAssignments.shiftId, shiftId),
          eq(shiftAssignments.businessId, access.business.id),
        ),
      );
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "shift.deleted",
      entityType: "shift",
      entityId: shiftId,
      shiftId,
      metadata: { previousStatus: existing.status, title: existing.title },
    });

    return { id: shiftId, deletedAt: deletedAt.toISOString() };
  });
}
