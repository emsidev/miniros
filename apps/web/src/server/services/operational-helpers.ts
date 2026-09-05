import { randomUUID } from "node:crypto";

import type { Database } from "@miniros/db";
import {
  auditLogs,
  inventoryLocations,
  shiftAssignments,
} from "@miniros/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

import { AccessError } from "./access";

export type OperationalTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export type OperationalAccess = {
  business: { id: string };
  employee: { id: string } | null;
  user: { id: string };
};

export function requireEmployee(
  access: OperationalAccess,
): asserts access is OperationalAccess & { employee: { id: string } } {
  if (!access.employee) {
    throw new AccessError("An active employee record is required.");
  }
}

export async function requireCurrentAssignment(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
  employeeId: string,
  allowCompleted = false,
) {
  const [assignment] = await tx
    .select({ id: shiftAssignments.id, status: shiftAssignments.status })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.businessId, businessId),
        eq(shiftAssignments.shiftId, shiftId),
        eq(shiftAssignments.employeeId, employeeId),
        inArray(
          shiftAssignments.status,
          allowCompleted
            ? ["assigned", "confirmed", "completed"]
            : ["assigned", "confirmed"],
        ),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw new AccessError("An active assignment to this shift is required.");
  }
  return assignment;
}

export async function getShiftInventoryLocation(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
) {
  const [location] = await tx
    .select({
      id: inventoryLocations.id,
      sellingLocationId: inventoryLocations.sellingLocationId,
    })
    .from(inventoryLocations)
    .where(
      and(
        eq(inventoryLocations.businessId, businessId),
        eq(inventoryLocations.shiftId, shiftId),
        eq(inventoryLocations.locationType, "shift"),
        eq(inventoryLocations.status, "active"),
        isNull(inventoryLocations.deletedAt),
      ),
    )
    .limit(1);

  if (!location) {
    throw new AccessError("The shift inventory location is not available.");
  }
  return location;
}

export async function insertAuditLog(
  tx: OperationalTransaction,
  access: OperationalAccess,
  input: {
    action: string;
    entityType: string;
    entityId?: string | null;
    shiftId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values({
    id: randomUUID(),
    businessId: access.business.id,
    actorUserId: access.user.id,
    actorEmployeeId: access.employee?.id ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    shiftId: input.shiftId,
    metadata: input.metadata,
  });
}
