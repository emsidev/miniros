import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { auditLogs, sellingLocations, shifts } from "@miniros/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import {
  createDefaultLocationCosts,
  replaceAssignments,
  replaceDefaultLocationCosts,
  requireScopedAssignments,
  requireScopedLocation,
} from "./admin-shift-persistence";
import { readShiftDetails } from "./admin-shift-read";
import {
  assertShiftCreateInput,
  assertShiftUpdateInput,
  type ShiftCreateInput,
  type ShiftUpdateInput,
} from "./admin-shift-types";

export type {
  ShiftAssignmentInput,
  ShiftCreateInput,
  ShiftUpdateInput,
} from "./admin-shift-types";
export {
  cancelAdminShift,
  replaceAdminShiftAssignments,
  softDeleteAdminShift,
} from "./admin-shift-maintenance";

export async function listAdminShifts() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const shiftRows = await database
    .select({ shift: shifts, locationName: sellingLocations.name })
    .from(shifts)
    .innerJoin(
      sellingLocations,
      and(
        eq(shifts.sellingLocationId, sellingLocations.id),
        eq(sellingLocations.businessId, business.id),
      ),
    )
    .where(and(eq(shifts.businessId, business.id), isNull(shifts.deletedAt)))
    .orderBy(asc(shifts.shiftDate), asc(shifts.createdAt));

  return readShiftDetails(database, business.id, shiftRows);
}

export async function createAdminShifts(input: ShiftCreateInput) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  assertShiftCreateInput(input);
  const shiftsToCreate = input.shiftDates.map((shiftDate) => ({
    id: randomUUID(),
    shiftDate,
  }));

  await database.transaction(async (tx) => {
    const location = await requireScopedLocation(
      tx,
      access.business.id,
      input.sellingLocationId,
    );
    await requireScopedAssignments(tx, access.business.id, input.assignments);

    await tx.insert(shifts).values(
      shiftsToCreate.map(({ id, shiftDate }) => ({
        id,
        businessId: access.business.id,
        sellingLocationId: location.id,
        title: input.title.trim(),
        shiftDate,
        status: "scheduled" as const,
        notes: null,
      })),
    );

    const auditEntries: (typeof auditLogs.$inferInsert)[] = [];
    for (const shift of shiftsToCreate) {
      await replaceAssignments(
        tx,
        access.business.id,
        shift.id,
        input.assignments,
        false,
      );
      const expectedCosts = await createDefaultLocationCosts(
        tx,
        access.business.id,
        shift.id,
        location,
        access.employee?.id ?? null,
      );
      auditEntries.push({
        id: randomUUID(),
        businessId: access.business.id,
        actorUserId: access.user.id,
        actorEmployeeId: access.employee?.id ?? null,
        action: "shift.created",
        entityType: "shift",
        entityId: shift.id,
        shiftId: shift.id,
        metadata: {
          locationId: location.id,
          shiftDate: shift.shiftDate,
          assignmentCount: input.assignments.length,
          ...expectedCosts,
          otherCostCents: 0,
        },
      });
    }
    await tx.insert(auditLogs).values(auditEntries);
  });

  return {
    createdCount: shiftsToCreate.length,
    shiftIds: shiftsToCreate.map((shift) => shift.id),
  };
}

export async function updateAdminShift(
  shiftId: string,
  input: ShiftUpdateInput,
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  assertShiftUpdateInput(input);

  await database.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: shifts.id,
        status: shifts.status,
        sellingLocationId: shifts.sellingLocationId,
      })
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
    if (existing.status !== "scheduled") {
      throw new AccessError("Only scheduled shifts can be edited.");
    }

    const location = await requireScopedLocation(
      tx,
      access.business.id,
      input.sellingLocationId,
    );
    await requireScopedAssignments(tx, access.business.id, input.assignments);
    const now = new Date();
    await tx
      .update(shifts)
      .set({
        sellingLocationId: location.id,
        title: input.title.trim(),
        shiftDate: input.shiftDate,
        updatedAt: now,
      })
      .where(
        and(eq(shifts.id, shiftId), eq(shifts.businessId, access.business.id)),
      );
    await replaceAssignments(
      tx,
      access.business.id,
      shiftId,
      input.assignments,
      false,
    );
    if (existing.sellingLocationId !== location.id) {
      await replaceDefaultLocationCosts(
        tx,
        access.business.id,
        shiftId,
        location,
        access.employee?.id ?? null,
      );
    }
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "shift.updated",
      entityType: "shift",
      entityId: shiftId,
      shiftId,
      metadata: {
        previousStatus: existing.status,
        status: existing.status,
        locationId: location.id,
        previousLocationId: existing.sellingLocationId,
        assignmentCount: input.assignments.length,
      },
    });
  });

  const updated = (await listAdminShifts()).find(
    (shift) => shift.id === shiftId,
  );
  if (!updated) throw new Error("Updated shift could not be read.");
  return updated;
}
