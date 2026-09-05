import { assertUnreservedShift } from "./offline-context";
import { lockBusinessSchedule } from "./schedule-lock";
import { createHash, randomUUID } from "node:crypto";
import {
  auditLogs,
  shiftAssignments,
  shiftCosts,
  shifts,
} from "@miniros/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  bulkDisabledReason,
  bulkShiftSchema,
  createShiftSchema,
  editableShift,
  updateShiftSchema,
  type BulkShiftInput,
  type ShiftCreateInput,
  type ShiftUpdateInput,
} from "@/lib/shift-planning";
import {
  replaceAssignments,
  replacePlannedCosts,
  requireScopedAssignments,
  requireScopedLocation,
  type ShiftTransaction,
} from "./admin-shift-persistence";
import { ShiftPlanningError } from "./shift-planning-error";
import {
  replaceBulkAssignments,
  validateBulkPlans,
} from "./admin-shift-bulk-persistence";

export type ShiftActor = {
  businessId: string;
  userId: string;
  employeeId: string | null;
};

async function audit(
  tx: ShiftTransaction,
  actor: ShiftActor,
  shiftId: string,
  action: string,
  metadata: Record<string, unknown>,
) {
  await tx.insert(auditLogs).values({
    id: randomUUID(),
    businessId: actor.businessId,
    actorUserId: actor.userId,
    actorEmployeeId: actor.employeeId,
    action,
    entityType: "shift",
    entityId: shiftId,
    shiftId,
    metadata,
  });
}

// All retries for a submitted batch resolve to the same shift IDs.
export function shiftRequestId(
  businessId: string,
  requestId: string,
  index: number,
) {
  const hex = createHash("sha256")
    .update(`${businessId}:${requestId}:${index}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function createShiftsInTransaction(
  tx: ShiftTransaction,
  actor: ShiftActor,
  rawInput: ShiftCreateInput,
) {
  const input = createShiftSchema.parse(rawInput);
  await lockBusinessSchedule(tx, actor.businessId);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  // Serialize retries even when no shift rows exist yet. Scoped to this business/request.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${actor.businessId}:${input.requestId}`}, 0))`,
  );
  const firstId = shiftRequestId(actor.businessId, input.requestId, 0);
  const [previous] = await tx
    .select({ metadata: auditLogs.metadata })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.businessId, actor.businessId),
        eq(auditLogs.entityId, firstId),
        eq(auditLogs.action, "shift.created"),
      ),
    )
    .limit(1);
  if (previous) {
    const metadata = previous.metadata as {
      batchShiftIds?: string[];
      fingerprint?: string;
    };
    if (metadata.fingerprint !== fingerprint)
      throw new ShiftPlanningError(
        "Your earlier request was saved before these changes. Return to shifts to edit that plan.",
      );
    if (metadata.batchShiftIds?.length)
      return {
        shiftIds: metadata.batchShiftIds,
        createdCount: metadata.batchShiftIds.length,
      };
    throw new ShiftPlanningError(
      "This request was already saved. Return to shifts to review it.",
    );
  }
  const publishing = input.intent === "publish";
  const location = await requireScopedLocation(
    tx,
    actor.businessId,
    input.sellingLocationId,
    publishing,
  );
  await requireScopedAssignments(
    tx,
    actor.businessId,
    input.assignments,
    publishing,
  );
  const shiftIds = input.shiftDates.map((_, index) =>
    shiftRequestId(actor.businessId, input.requestId, index),
  );
  await tx.insert(shifts).values(
    input.shiftDates.map((shiftDate, index) => ({
      id: shiftIds[index]!,
      businessId: actor.businessId,
      sellingLocationId: location.id,
      title: input.title || location.name,
      shiftDate,
      status: publishing ? ("scheduled" as const) : ("draft" as const),
      clientGeneratedId: shiftIds[index]!,
    })),
  );
  const assignmentRows = shiftIds.flatMap((shiftId) =>
    input.assignments.map((assignment) => ({
      ...assignment,
      id: randomUUID(),
      businessId: actor.businessId,
      shiftId,
      status: publishing ? ("assigned" as const) : ("draft" as const),
    })),
  );
  const costRows = shiftIds.flatMap((shiftId) =>
    input.costs.map((cost) => ({
      ...cost,
      id: randomUUID(),
      businessId: actor.businessId,
      shiftId,
      createdBy: actor.employeeId,
    })),
  );
  // Bound parameter counts while keeping large date ranges to a few round trips.
  for (let index = 0; index < assignmentRows.length; index += 500)
    await tx
      .insert(shiftAssignments)
      .values(assignmentRows.slice(index, index + 500));
  for (let index = 0; index < costRows.length; index += 500)
    await tx.insert(shiftCosts).values(costRows.slice(index, index + 500));
  await tx.insert(auditLogs).values(
    shiftIds.map((shiftId, index) => ({
      id: randomUUID(),
      businessId: actor.businessId,
      actorUserId: actor.userId,
      actorEmployeeId: actor.employeeId,
      action: "shift.created",
      entityType: "shift",
      entityId: shiftId,
      shiftId,
      metadata: {
        requestId: input.requestId,
        ...(index === 0 ? { fingerprint, batchShiftIds: shiftIds } : {}),
        shiftDate: input.shiftDates[index]!,
        status: publishing ? "scheduled" : "draft",
        assignmentCount: input.assignments.length,
      },
    })),
  );
  return { shiftIds, createdCount: shiftIds.length };
}

export async function lockShiftVersions(
  tx: ShiftTransaction,
  actor: ShiftActor,
  versions: Array<{ id: string; updatedAt: string }>,
) {
  await lockBusinessSchedule(tx, actor.businessId);
  const rows = await tx
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.businessId, actor.businessId),
        inArray(
          shifts.id,
          versions.map((item) => item.id),
        ),
        isNull(shifts.deletedAt),
      ),
    )
    .orderBy(shifts.id)
    .for("update");
  if (rows.length !== versions.length)
    throw new ShiftPlanningError(
      "A selected shift is unavailable. Refresh the schedule and select it again.",
    );
  const expected = new Map(versions.map((item) => [item.id, item.updatedAt]));
  const stale = rows.filter(
    (item) => item.updatedAt.toISOString() !== expected.get(item.id),
  );
  if (stale.length)
    throw new ShiftPlanningError(
      `These shifts changed: ${stale.map((item) => `${item.title || "Shift"} (${item.shiftDate})`).join(", ")}. Reload before applying changes.`,
      Object.fromEntries(
        stale.map((item) => [
          `shifts.${item.id}`,
          ["This shift changed. Reload it before continuing."],
        ]),
      ),
    );
  for (const row of rows)
    await assertUnreservedShift(tx, actor.businessId, row.id);
  return rows;
}

export async function updateShiftInTransaction(
  tx: ShiftTransaction,
  actor: ShiftActor,
  rawInput: ShiftUpdateInput,
) {
  const input = updateShiftSchema.parse(rawInput);
  const [existing] = await lockShiftVersions(tx, actor, [
    { id: input.shiftId, updatedAt: input.expectedUpdatedAt },
  ]);
  if (!existing || !editableShift(existing.status))
    throw new ShiftPlanningError(
      "Only draft and scheduled shifts can be edited. This shift may have started.",
    );
  if (existing.status === "scheduled" && input.intent === "draft")
    throw new ShiftPlanningError(
      "A published shift cannot be returned to draft. Save changes or cancel it.",
    );
  const publishing =
    existing.status === "scheduled" || input.intent === "publish";
  const location = await requireScopedLocation(
    tx,
    actor.businessId,
    input.sellingLocationId,
    publishing,
  );
  await requireScopedAssignments(
    tx,
    actor.businessId,
    input.assignments,
    publishing,
  );
  const status = publishing ? "scheduled" : "draft";
  await replaceAssignments(
    tx,
    actor.businessId,
    existing.id,
    input.assignments,
    publishing ? "assigned" : "draft",
  );
  await replacePlannedCosts(
    tx,
    actor.businessId,
    existing.id,
    input.costs,
    actor.employeeId,
  );
  const [updated] = await tx
    .update(shifts)
    .set({
      title: input.title || location.name,
      sellingLocationId: location.id,
      shiftDate: input.shiftDate,
      status,
      updatedAt: new Date(
        Math.max(Date.now(), existing.updatedAt.getTime() + 1),
      ),
    })
    .where(
      and(eq(shifts.id, existing.id), eq(shifts.businessId, actor.businessId)),
    )
    .returning();
  await audit(
    tx,
    actor,
    existing.id,
    existing.status === "draft" && publishing
      ? "shift.published"
      : "shift.updated",
    {
      previousStatus: existing.status,
      status,
      shiftDate: input.shiftDate,
      locationId: location.id,
      assignments: input.assignments,
      costs: input.costs,
    },
  );
  return {
    id: existing.id,
    title: updated!.title,
    updatedAt: updated!.updatedAt.toISOString(),
  };
}

export async function bulkShiftsInTransaction(
  tx: ShiftTransaction,
  actor: ShiftActor,
  rawInput: BulkShiftInput,
) {
  const input = bulkShiftSchema.parse(rawInput);
  const rows = await lockShiftVersions(tx, actor, input.shifts);
  const reason = bulkDisabledReason(input.operation, rows);
  if (reason) throw new ShiftPlanningError(reason);
  const shiftIds = rows.map((row) => row.id);
  if (input.operation !== "cancel")
    await validateBulkPlans(tx, actor.businessId, rows, input);
  if (input.operation === "team")
    await replaceBulkAssignments(
      tx,
      actor.businessId,
      rows,
      input.assignments!,
    );
  else
    await tx
      .update(shiftAssignments)
      .set({
        status: input.operation === "cancel" ? "cancelled" : "assigned",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(shiftAssignments.businessId, actor.businessId),
          inArray(shiftAssignments.shiftId, shiftIds),
          input.operation === "publish"
            ? eq(shiftAssignments.status, "draft")
            : undefined,
        ),
      );
  const updatedAt = new Date(
    Math.max(Date.now(), ...rows.map((row) => row.updatedAt.getTime() + 1)),
  );
  await tx
    .update(shifts)
    .set({
      ...(input.operation === "team"
        ? {}
        : {
            status:
              input.operation === "cancel"
                ? ("cancelled" as const)
                : ("scheduled" as const),
          }),
      updatedAt,
    })
    .where(
      and(
        eq(shifts.businessId, actor.businessId),
        inArray(shifts.id, shiftIds),
      ),
    );
  await tx.insert(auditLogs).values(
    rows.map((shift) => ({
      id: randomUUID(),
      businessId: actor.businessId,
      actorUserId: actor.userId,
      actorEmployeeId: actor.employeeId,
      action:
        input.operation === "team"
          ? "shift.assignments_replaced"
          : input.operation === "publish"
            ? "shift.published"
            : "shift.cancelled",
      entityType: "shift",
      entityId: shift.id,
      shiftId: shift.id,
      metadata: {
        previousStatus: shift.status,
        status:
          input.operation === "team"
            ? shift.status
            : input.operation === "publish"
              ? "scheduled"
              : "cancelled",
        assignments: input.assignments ?? null,
      },
    })),
  );
  return { count: rows.length, shiftIds };
}
