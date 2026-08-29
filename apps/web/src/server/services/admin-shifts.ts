import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { auditLogs, sellingLocations, shifts } from "@miniros/db/schema";
import { sumCents } from "@miniros/domain";
import { and, desc, eq, isNull } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import {
  requireScopedAssignments,
  requireScopedLocation,
  replaceAssignments,
  replaceCosts,
} from "./admin-shift-persistence";
import { readShiftDetails } from "./admin-shift-read";
import {
  assertShiftInput,
  nullableText,
  type ShiftUpdateInput,
  type ShiftWriteInput,
} from "./admin-shift-types";

export type {
  ShiftAssignmentInput,
  ShiftUpdateInput,
  ShiftWriteInput,
} from "./admin-shift-types";
export {
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
    .orderBy(desc(shifts.shiftDate), desc(shifts.scheduledStartAt));

  return readShiftDetails(database, business.id, shiftRows);
}

export async function createAdminShift(input: ShiftWriteInput) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  assertShiftInput(input);

  const shiftId = randomUUID();
  await database.transaction(async (tx) => {
    const location = await requireScopedLocation(
      tx,
      access.business.id,
      input.sellingLocationId,
    );
    await requireScopedAssignments(tx, access.business.id, input.assignments);

    await tx.insert(shifts).values({
      id: shiftId,
      businessId: access.business.id,
      sellingLocationId: location.id,
      title: nullableText(input.title),
      shiftDate: input.shiftDate,
      scheduledStartAt: input.scheduledStartAt
        ? new Date(input.scheduledStartAt)
        : null,
      scheduledEndAt: input.scheduledEndAt
        ? new Date(input.scheduledEndAt)
        : null,
      status: "scheduled",
      notes: nullableText(input.notes),
    });
    await replaceAssignments(
      tx,
      access.business.id,
      shiftId,
      input.assignments,
      false,
    );
    const expectedCosts = await replaceCosts(
      tx,
      access.business.id,
      shiftId,
      input,
      location,
      access.employee?.id ?? null,
    );
    sumCents(
      expectedCosts.rentalCostCents,
      expectedCosts.transportCostCents,
      input.otherCostCents,
    );
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "shift.created",
      entityType: "shift",
      entityId: shiftId,
      shiftId,
      metadata: {
        locationId: location.id,
        shiftDate: input.shiftDate,
        assignmentCount: input.assignments.length,
        ...expectedCosts,
        otherCostCents: input.otherCostCents,
      },
    });
  });

  const created = (await listAdminShifts()).find(
    (shift) => shift.id === shiftId,
  );
  if (!created) throw new Error("Created shift could not be read.");
  return created;
}

export async function updateAdminShift(
  shiftId: string,
  input: ShiftUpdateInput,
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  assertShiftInput(input);

  await database.transaction(async (tx) => {
    const [existing] = await tx
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
    if (!existing) throw new AccessError("Shift not found.");
    if (existing.status !== "scheduled" && existing.status !== "cancelled") {
      throw new AccessError(
        "Only scheduled or cancelled shifts can be edited.",
      );
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
        title: nullableText(input.title),
        shiftDate: input.shiftDate,
        scheduledStartAt: input.scheduledStartAt
          ? new Date(input.scheduledStartAt)
          : null,
        scheduledEndAt: input.scheduledEndAt
          ? new Date(input.scheduledEndAt)
          : null,
        status: input.status,
        notes: nullableText(input.notes),
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
      input.status === "cancelled",
    );
    const expectedCosts = await replaceCosts(
      tx,
      access.business.id,
      shiftId,
      input,
      location,
      access.employee?.id ?? null,
    );
    sumCents(
      expectedCosts.rentalCostCents,
      expectedCosts.transportCostCents,
      input.otherCostCents,
    );
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
        status: input.status,
        locationId: location.id,
        assignmentCount: input.assignments.length,
        ...expectedCosts,
        otherCostCents: input.otherCostCents,
      },
    });
  });

  const updated = (await listAdminShifts()).find(
    (shift) => shift.id === shiftId,
  );
  if (!updated) throw new Error("Updated shift could not be read.");
  return updated;
}
