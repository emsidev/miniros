import { requireDatabase } from "@miniros/db";
import {
  offlineShiftSessions,
  shifts,
  v2Authorities,
} from "@miniros/db/schema";
import { and, eq, notInArray, isNull } from "drizzle-orm";
import { requireActiveBusiness } from "./access";
/** Presentation only. Financial services still lock and enforce reciprocal authority. */
export async function isLegacyOnlineShift(shiftId: string) {
  const { business } = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: shiftId,
  });
  const db = requireDatabase();
  const [shift] = await db
    .select({ status: shifts.status })
    .from(shifts)
    .where(
      and(
        eq(shifts.id, shiftId),
        eq(shifts.businessId, business.id),
        isNull(shifts.deletedAt),
      ),
    )
    .limit(1);
  if (!shift || !["active", "closing", "closed"].includes(shift.status))
    return false;
  const [sessions, authorities] = await Promise.all([
    db
      .select({ id: offlineShiftSessions.id })
      .from(offlineShiftSessions)
      .where(
        and(
          eq(offlineShiftSessions.shiftId, shiftId),
          eq(offlineShiftSessions.businessId, business.id),
          notInArray(offlineShiftSessions.status, ["released"]),
        ),
      ),
    db
      .select({ id: v2Authorities.id })
      .from(v2Authorities)
      .where(
        and(
          eq(v2Authorities.shiftId, shiftId),
          eq(v2Authorities.businessId, business.id),
        ),
      ),
  ]);
  return !sessions.length && !authorities.length;
}
