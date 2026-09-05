import { randomUUID } from "node:crypto";
import type { Database } from "@miniros/db";
import {
  employees,
  sellingLocations,
  shiftAssignments,
  shiftCosts,
} from "@miniros/db/schema";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import {
  type PlannedCostInput,
  type ShiftAssignmentInput,
} from "@/lib/shift-planning";
import { ShiftPlanningError } from "./shift-planning-error";

export type ShiftTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export async function requireScopedLocation(
  tx: ShiftTransaction,
  businessId: string,
  locationId: string,
  publishing = true,
) {
  const [location] = await tx
    .select()
    .from(sellingLocations)
    .where(
      and(
        eq(sellingLocations.id, locationId),
        eq(sellingLocations.businessId, businessId),
      ),
    )
    .limit(1)
    .for("share");
  return validateLocation(location, publishing);
}

export function validateLocation(
  location: typeof sellingLocations.$inferSelect | undefined,
  publishing: boolean,
) {
  if (
    !location ||
    (publishing && (location.status !== "active" || location.deletedAt))
  ) {
    throw new ShiftPlanningError("Choose an available selling location.", {
      sellingLocationId: [
        "This location is unavailable. Choose an active location before publishing.",
      ],
    });
  }
  return location;
}

export async function requireScopedAssignments(
  tx: ShiftTransaction,
  businessId: string,
  assignments: ShiftAssignmentInput[],
  publishing = true,
) {
  if (!assignments.length) {
    validateAssignments(assignments, new Map(), publishing);
    return;
  }
  const rows = await tx
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.businessId, businessId),
        inArray(
          employees.id,
          assignments.map((item) => item.employeeId),
        ),
      ),
    )
    .orderBy(employees.id)
    .for("share");
  validateAssignments(
    assignments,
    new Map(rows.map((item) => [item.id, item])),
    publishing,
  );
}

export function validateAssignments(
  assignments: ShiftAssignmentInput[],
  byId: Map<string, typeof employees.$inferSelect>,
  publishing: boolean,
) {
  if (
    publishing &&
    !assignments.some((item) => item.roleOnShift === "operator")
  ) {
    throw new ShiftPlanningError("Add a POS operator before publishing.", {
      assignments: [
        "Assign at least one employee with POS access as an operator.",
      ],
    });
  }

  const errors: Record<string, string[]> = {};
  assignments.forEach((assignment, index) => {
    const employee = byId.get(assignment.employeeId);
    if (
      !employee ||
      (publishing && (employee.status !== "active" || employee.deletedAt))
    )
      errors[`assignments.${index}.employeeId`] = [
        "This employee is unavailable. Remove or replace them before publishing.",
      ];
    else if (
      publishing &&
      assignment.roleOnShift === "operator" &&
      !employee.canUsePos
    )
      errors[`assignments.${index}.roleOnShift`] = [
        `${employee.displayName} does not have POS access.`,
      ];
  });
  if (Object.keys(errors).length)
    throw new ShiftPlanningError(
      "Review the highlighted team members.",
      errors,
    );
}

export async function replaceAssignments(
  tx: ShiftTransaction,
  businessId: string,
  shiftId: string,
  assignments: ShiftAssignmentInput[],
  status: "draft" | "assigned",
) {
  const existing = await tx
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.businessId, businessId),
        eq(shiftAssignments.shiftId, shiftId),
      ),
    );
  const byEmployee = new Map(existing.map((item) => [item.employeeId, item]));
  const requested = new Set(assignments.map((item) => item.employeeId));
  const now = new Date();
  for (const item of existing.filter(
    (item) => !requested.has(item.employeeId),
  )) {
    await tx
      .update(shiftAssignments)
      .set({ status: "cancelled", updatedAt: now })
      .where(
        and(
          eq(shiftAssignments.id, item.id),
          eq(shiftAssignments.businessId, businessId),
        ),
      );
  }
  for (const assignment of assignments) {
    const item = byEmployee.get(assignment.employeeId);
    if (item) {
      await tx
        .update(shiftAssignments)
        .set({
          ...assignment,
          status:
            status === "assigned" && item.status === "confirmed"
              ? "confirmed"
              : status,
          updatedAt: now,
        })
        .where(
          and(
            eq(shiftAssignments.id, item.id),
            eq(shiftAssignments.businessId, businessId),
          ),
        );
    } else {
      await tx.insert(shiftAssignments).values({
        id: randomUUID(),
        businessId,
        shiftId,
        ...assignment,
        status,
      });
    }
  }
}

export async function replacePlannedCosts(
  tx: ShiftTransaction,
  businessId: string,
  shiftId: string,
  costs: PlannedCostInput[],
  actorEmployeeId: string | null,
) {
  const existing = await tx
    .select()
    .from(shiftCosts)
    .where(
      and(
        eq(shiftCosts.businessId, businessId),
        eq(shiftCosts.shiftId, shiftId),
      ),
    );
  const byId = new Map(existing.map((cost) => [cost.id, cost]));
  if (costs.some((cost) => cost.id && !byId.has(cost.id)))
    throw new ShiftPlanningError(
      "A cost changed or is unavailable. Reload the shift before saving.",
    );
  const retained = costs.flatMap((cost) => (cost.id ? [cost.id] : []));
  await tx
    .delete(shiftCosts)
    .where(
      and(
        eq(shiftCosts.businessId, businessId),
        eq(shiftCosts.shiftId, shiftId),
        retained.length ? notInArray(shiftCosts.id, retained) : undefined,
      ),
    );
  for (const cost of costs) {
    const values = {
      costType: cost.costType,
      label: cost.label,
      amountCents: cost.amountCents,
      notes: cost.notes ?? null,
    };
    if (cost.id)
      await tx
        .update(shiftCosts)
        .set({ ...values, updatedAt: new Date() })
        .where(
          and(
            eq(shiftCosts.id, cost.id),
            eq(shiftCosts.businessId, businessId),
            eq(shiftCosts.shiftId, shiftId),
          ),
        );
    else
      await tx.insert(shiftCosts).values({
        id: randomUUID(),
        businessId,
        shiftId,
        ...values,
        createdBy: actorEmployeeId,
      });
  }
}
