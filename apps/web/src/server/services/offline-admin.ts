import type { PreparedSnapshot } from "@miniros/contracts";
import { requireDatabase } from "@miniros/db";
import {
  offlineShiftSessions,
  offlineSyncActions,
  shifts,
  employees,
} from "@miniros/db/schema";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import { lockShift } from "./offline-context";
import { installationId } from "./offline-prepare";
import { insertAuditLog } from "./operational-helpers";
import {
  deviceNeedsAttention,
  type AdminDeviceSession,
} from "@/lib/offline/admin-devices";

export async function getOfflineAdministration() {
  const access = await requireActiveBusiness({ admin: true });
  const db = requireDatabase();
  const rows = await db
    .select({
      id: offlineShiftSessions.id,
      shiftId: offlineShiftSessions.shiftId,
      status: offlineShiftSessions.status,
      acknowledgedSequence: offlineShiftSessions.acknowledgedSequence,
      lastError: offlineShiftSessions.lastError,
      snapshot: offlineShiftSessions.snapshot,
      title: shifts.title,
      operator: employees.displayName,
      lastAcknowledgedAt: sql<
        string | null
      >`(select max(a.synced_at) from offline_sync_actions a where a.business_id = ${offlineShiftSessions.businessId} and a.session_id = ${offlineShiftSessions.id} and a.status = 'synced')`,
    })
    .from(offlineShiftSessions)
    .innerJoin(
      shifts,
      and(
        eq(shifts.id, offlineShiftSessions.shiftId),
        eq(shifts.businessId, offlineShiftSessions.businessId),
      ),
    )
    .leftJoin(
      employees,
      and(
        sql`${employees.id}::text = ${offlineShiftSessions.snapshot}->>'employeeId'`,
        eq(employees.businessId, offlineShiftSessions.businessId),
      ),
    )
    .where(
      and(
        eq(offlineShiftSessions.businessId, access.business.id),
        notInArray(offlineShiftSessions.status, ["closed", "released"]),
      ),
    );
  const sessions: AdminDeviceSession[] = rows.map(
    ({ snapshot: data, title, operator, ...row }) => {
      const snapshot = data as PreparedSnapshot;
      return {
        ...row,
        title: title || snapshot.locationName,
        locationName: snapshot.locationName,
        shiftDate: snapshot.shiftDate,
        operator: operator || "Former team member",
        deviceLabel: `Device ${snapshot.storageInstallationId.slice(0, 8)}`,
        lastAcknowledgedAt: row.lastAcknowledgedAt
          ? new Date(row.lastAcknowledgedAt).toISOString()
          : null,
      };
    },
  );
  return sessions.sort(
    (a, b) =>
      Number(deviceNeedsAttention(b)) - Number(deviceNeedsAttention(a)) ||
      b.shiftDate.localeCompare(a.shiftDate) ||
      a.id.localeCompare(b.id),
  );
}
export async function recoverOfflineDevice(
  sessionId: string,
  decision: "freeze" | "restore",
  reason: string,
) {
  const access = await requireActiveBusiness({ admin: true });
  return requireDatabase().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(offlineShiftSessions)
      .where(
        and(
          eq(offlineShiftSessions.id, sessionId),
          eq(offlineShiftSessions.businessId, access.business.id),
        ),
      )
      .limit(1);
    if (!row) throw new AccessError("Prepared device not found.");
    await lockShift(tx, access.business.id, row.shiftId);
    const [session] = await tx
      .select()
      .from(offlineShiftSessions)
      .where(eq(offlineShiftSessions.id, row.id))
      .for("update")
      .limit(1);
    if (!session || ["closed", "released"].includes(session.status))
      throw new AccessError("This session is already complete.");
    const status =
      decision === "freeze"
        ? "recovery"
        : session.closeoutIntent
          ? "closing"
          : session.acknowledgedSequence
            ? "active"
            : "prepared";
    await tx
      .update(offlineShiftSessions)
      .set({
        status,
        lastError: decision === "freeze" ? `Owner recovery: ${reason}` : null,
        updatedAt: new Date(),
      })
      .where(eq(offlineShiftSessions.id, session.id));
    await insertAuditLog(tx, access, {
      action: `offline.recovery_${decision}`,
      entityType: "offline_shift_session",
      entityId: session.id,
      shiftId: session.shiftId,
      metadata: { reason, acknowledgedSequence: session.acknowledgedSequence },
    });
    return { status };
  });
}
export async function releasePreparedShift(
  sessionId: string,
  storageId: string,
) {
  const access = await requireActiveBusiness();
  const deviceId = await installationId();
  return requireDatabase().transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(offlineShiftSessions)
      .where(
        and(
          eq(offlineShiftSessions.id, sessionId),
          eq(offlineShiftSessions.businessId, access.business.id),
        ),
      )
      .limit(1);
    if (
      !session ||
      session.userId !== access.user.id ||
      session.deviceId !== deviceId ||
      (session.snapshot as PreparedSnapshot).storageInstallationId !== storageId
    )
      throw new AccessError("Only the prepared device can release this shift.");
    await lockShift(tx, access.business.id, session.shiftId);
    const [released] = await tx
      .update(offlineShiftSessions)
      .set({ status: "released", updatedAt: new Date() })
      .where(
        and(
          eq(offlineShiftSessions.id, sessionId),
          eq(offlineShiftSessions.status, "prepared"),
          eq(offlineShiftSessions.acknowledgedSequence, 0),
        ),
      )
      .returning({ id: offlineShiftSessions.id });
    if (!released)
      throw new AccessError(
        "Only an unused preparation can be released. Finish and synchronize an operating shift.",
      );
    await insertAuditLog(tx, access, {
      action: "offline.released",
      entityType: "offline_shift_session",
      entityId: sessionId,
      shiftId: session.shiftId,
    });
    return { released: true };
  });
}
export async function offlineRecoveryJournal(sessionId: string) {
  const access = await requireActiveBusiness({ admin: true });
  const [session] = await requireDatabase()
    .select({ id: offlineShiftSessions.id })
    .from(offlineShiftSessions)
    .where(
      and(
        eq(offlineShiftSessions.businessId, access.business.id),
        eq(offlineShiftSessions.id, sessionId),
      ),
    )
    .limit(1);
  if (!session) throw new AccessError("Shift device not found.");
  return requireDatabase()
    .select({
      sequence: offlineSyncActions.sequence,
      status: offlineSyncActions.status,
      conflictCode: offlineSyncActions.conflictCode,
      errorMessage: offlineSyncActions.errorMessage,
      payloadDigest: offlineSyncActions.payloadDigest,
      actionType: offlineSyncActions.actionType,
      payload: offlineSyncActions.payload,
      result: offlineSyncActions.result,
      syncedAt: offlineSyncActions.syncedAt,
      createdAt: offlineSyncActions.createdAt,
    })
    .from(offlineSyncActions)
    .where(
      and(
        eq(offlineSyncActions.businessId, access.business.id),
        eq(offlineSyncActions.sessionId, sessionId),
      ),
    )
    .orderBy(offlineSyncActions.sequence);
}
