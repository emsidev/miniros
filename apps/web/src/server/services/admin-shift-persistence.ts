import { randomUUID } from "node:crypto";
import type { Database } from "@miniros/db";
import {
  employees,
  sellingLocations,
  shiftAssignments,
  shiftCosts,
} from "@miniros/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { AccessError } from "./access";
import {
  nullableText,
  type ShiftAssignmentInput,
  type ShiftWriteInput,
} from "./admin-shift-types";

type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export async function requireScopedLocation(
  tx: DatabaseTransaction,
  businessId: string,
  locationId: string,
) {
  const [location] = await tx
    .select({
      id: sellingLocations.id,
      name: sellingLocations.name,
      defaultRentalCostCents: sellingLocations.defaultRentalCostCents,
      defaultTransportCostCents: sellingLocations.defaultTransportCostCents,
    })
    .from(sellingLocations)
    .where(
      and(
        eq(sellingLocations.id, locationId),
        eq(sellingLocations.businessId, businessId),
        eq(sellingLocations.status, "active"),
        isNull(sellingLocations.deletedAt),
      ),
    )
    .limit(1);

  if (!location) {
    throw new AccessError("The selected selling location is unavailable.");
  }
  return location;
}

export async function requireScopedAssignments(
  tx: DatabaseTransaction,
  businessId: string,
  assignments: ShiftAssignmentInput[],
) {
  const employeeIds = assignments.map((item) => item.employeeId);
  const scopedEmployees = await tx
    .select({
      id: employees.id,
      displayName: employees.displayName,
      canUsePos: employees.canUsePos,
    })
    .from(employees)
    .where(
      and(
        eq(employees.businessId, businessId),
        inArray(employees.id, employeeIds),
        eq(employees.status, "active"),
        isNull(employees.deletedAt),
      ),
    );

  if (scopedEmployees.length !== employeeIds.length) {
    throw new AccessError("One or more assigned employees are unavailable.");
  }

  const employeeById = new Map(
    scopedEmployees.map((employee) => [employee.id, employee]),
  );
  for (const assignment of assignments) {
    const employee = employeeById.get(assignment.employeeId);
    if (assignment.roleOnShift === "operator" && !employee?.canUsePos) {
      throw new AccessError(
        `${employee?.displayName ?? "The selected employee"} does not have POS permission.`,
      );
    }
  }
}

export async function replaceAssignments(
  tx: DatabaseTransaction,
  businessId: string,
  shiftId: string,
  assignments: ShiftAssignmentInput[],
  cancelled: boolean,
) {
  const existingAssignments = await tx
    .select()
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.businessId, businessId),
        eq(shiftAssignments.shiftId, shiftId),
      ),
    );
  const existingByEmployee = new Map(
    existingAssignments.map((assignment) => [
      assignment.employeeId,
      assignment,
    ]),
  );
  const requestedIds = new Set(assignments.map((item) => item.employeeId));
  const now = new Date();

  for (const existing of existingAssignments) {
    if (!requestedIds.has(existing.employeeId)) {
      await tx
        .update(shiftAssignments)
        .set({ status: "cancelled", updatedAt: now })
        .where(
          and(
            eq(shiftAssignments.id, existing.id),
            eq(shiftAssignments.businessId, businessId),
            eq(shiftAssignments.shiftId, shiftId),
          ),
        );
    }
  }

  const newAssignments: (typeof shiftAssignments.$inferInsert)[] = [];
  for (const assignment of assignments) {
    const existing = existingByEmployee.get(assignment.employeeId);
    if (existing) {
      await tx
        .update(shiftAssignments)
        .set({
          roleOnShift: assignment.roleOnShift,
          salaryRateCents: assignment.salaryRateCents,
          status: cancelled ? "cancelled" : "assigned",
          updatedAt: now,
        })
        .where(
          and(
            eq(shiftAssignments.id, existing.id),
            eq(shiftAssignments.businessId, businessId),
            eq(shiftAssignments.shiftId, shiftId),
          ),
        );
    } else {
      newAssignments.push({
        id: randomUUID(),
        businessId,
        shiftId,
        employeeId: assignment.employeeId,
        roleOnShift: assignment.roleOnShift,
        salaryRateCents: assignment.salaryRateCents,
        status: cancelled ? "cancelled" : "assigned",
      });
    }
  }

  if (newAssignments.length) {
    await tx.insert(shiftAssignments).values(newAssignments);
  }
}

export async function replaceCosts(
  tx: DatabaseTransaction,
  businessId: string,
  shiftId: string,
  input: ShiftWriteInput,
  location: Awaited<ReturnType<typeof requireScopedLocation>>,
  actorEmployeeId: string | null,
) {
  const rentalCostCents =
    input.rentalCostCents ?? location.defaultRentalCostCents;
  const transportCostCents =
    input.transportCostCents ?? location.defaultTransportCostCents;

  await tx
    .delete(shiftCosts)
    .where(
      and(
        eq(shiftCosts.businessId, businessId),
        eq(shiftCosts.shiftId, shiftId),
      ),
    );

  const costs: (typeof shiftCosts.$inferInsert)[] = [
    {
      id: randomUUID(),
      businessId,
      shiftId,
      costType: "rent",
      label: "Rental cost",
      amountCents: rentalCostCents,
      createdBy: actorEmployeeId,
    },
    {
      id: randomUUID(),
      businessId,
      shiftId,
      costType: "transport",
      label: "Transport cost",
      amountCents: transportCostCents,
      createdBy: actorEmployeeId,
    },
  ];

  if (input.otherCostCents > 0) {
    costs.push({
      id: randomUUID(),
      businessId,
      shiftId,
      costType: "other",
      label: nullableText(input.otherCostLabel) ?? "Other cost",
      amountCents: input.otherCostCents,
      createdBy: actorEmployeeId,
    });
  }
  await tx.insert(shiftCosts).values(costs);

  return { rentalCostCents, transportCostCents };
}
