import { requireDatabase } from "@miniros/db";
import {
  inventoryLocations,
  sellingLocations,
  shiftAssignments,
  shifts,
} from "@miniros/db/schema";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { BusinessFeatureKey } from "@miniros/domain";

import { requireActiveBusiness } from "./access";
import { AccessError } from "./access-error";
import { OperationalShiftUnavailableError } from "./operator-workspace-errors";
export {
  OperationalShiftUnavailableError,
  type OperationalShiftUnavailableReason,
} from "./operator-workspace-errors";

export type OperationalPermission = "pos" | "production";
export type OpenShiftStatus = "scheduled" | "active" | "closing";

export async function resolveOperationalShift(input: {
  permission?: OperationalPermission;
  feature?: BusinessFeatureKey;
  shiftId?: string;
  statuses: readonly OpenShiftStatus[];
}) {
  const access = await requireActiveBusiness({
    feature: input.feature,
    employeePermission: input.permission,
  });
  if (!access.employee) {
    throw new AccessError("An active employee record is required.");
  }

  const conditions = [
    eq(shiftAssignments.businessId, access.business.id),
    eq(shiftAssignments.employeeId, access.employee.id),
    inArray(shiftAssignments.status, ["assigned", "confirmed"]),
    eq(shifts.businessId, access.business.id),
    inArray(shifts.status, [...input.statuses]),
    isNull(shifts.deletedAt),
    eq(sellingLocations.businessId, access.business.id),
    eq(sellingLocations.status, "active"),
    isNull(sellingLocations.deletedAt),
  ];
  if (input.shiftId) conditions.push(eq(shifts.id, input.shiftId));

  const [shift] = await requireDatabase()
    .select({
      id: shifts.id,
      title: shifts.title,
      shiftDate: shifts.shiftDate,
      status: shifts.status,
      locationId: sellingLocations.id,
      locationName: sellingLocations.name,
      inventoryLocationId: inventoryLocations.id,
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
      inventoryLocations,
      and(
        eq(inventoryLocations.shiftId, shifts.id),
        eq(inventoryLocations.businessId, shifts.businessId),
        eq(inventoryLocations.locationType, "shift"),
        eq(inventoryLocations.status, "active"),
        isNull(inventoryLocations.deletedAt),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(shifts.shiftDate), desc(shifts.createdAt))
    .limit(1);

  if (!shift) {
    throw new OperationalShiftUnavailableError(
      input.shiftId ? "requested_shift_unavailable" : "no_active_shift",
    );
  }

  return { access, shift };
}
