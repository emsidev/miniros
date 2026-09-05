import { requireDatabase } from "@miniros/db";
import { sellingLocations, shifts } from "@miniros/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireActiveBusiness } from "./access";
import { readShiftDetails } from "./admin-shift-read";
import {
  bulkShiftsInTransaction,
  createShiftsInTransaction,
  updateShiftInTransaction,
} from "./admin-shift-workflows";
import type {
  BulkShiftInput,
  ShiftCreateInput,
  ShiftUpdateInput,
} from "./admin-shift-types";
import { ShiftPlanningError } from "./shift-planning-error";
export type {
  ShiftAssignmentInput,
  ShiftCreateInput,
  ShiftUpdateInput,
} from "./admin-shift-types";

export async function listAdminShifts(shiftId?: string) {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const rows = await database
    .select({ shift: shifts, locationName: sellingLocations.name })
    .from(shifts)
    .innerJoin(
      sellingLocations,
      and(
        eq(shifts.sellingLocationId, sellingLocations.id),
        eq(sellingLocations.businessId, business.id),
      ),
    )
    .where(
      and(
        eq(shifts.businessId, business.id),
        isNull(shifts.deletedAt),
        shiftId ? eq(shifts.id, shiftId) : undefined,
      ),
    )
    .orderBy(asc(shifts.shiftDate), asc(shifts.createdAt));
  return readShiftDetails(database, business.id, rows);
}

export async function getAdminShift(shiftId: string) {
  const [shift] = await listAdminShifts(shiftId);
  if (!shift)
    throw new ShiftPlanningError("Shift not found in the active business.");
  return shift;
}

async function actor() {
  const access = await requireActiveBusiness({ admin: true });
  return {
    businessId: access.business.id,
    userId: access.user.id,
    employeeId: access.employee?.id ?? null,
  };
}
export async function createAdminShifts(input: ShiftCreateInput) {
  const context = await actor();
  return requireDatabase().transaction((tx) =>
    createShiftsInTransaction(tx, context, input),
  );
}
export async function updateAdminShift(input: ShiftUpdateInput) {
  const context = await actor();
  return requireDatabase().transaction((tx) =>
    updateShiftInTransaction(tx, context, input),
  );
}
export async function bulkAdminShifts(input: BulkShiftInput) {
  const context = await actor();
  return requireDatabase().transaction((tx) =>
    bulkShiftsInTransaction(tx, context, input),
  );
}
