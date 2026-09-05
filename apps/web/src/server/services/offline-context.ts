import { requireDatabase } from "@miniros/db";
import { offlineShiftSessions, shifts } from "@miniros/db/schema";
import type { PreparedSnapshot } from "@miniros/contracts";
import { and, eq, notInArray } from "drizzle-orm";
import { AccessError } from "./access-error";
import type { OperationalTransaction } from "./operational-helpers";

/** Internal only. Never constructed from a request payload. */
export type PreparedOperationContext = {
  tx: OperationalTransaction;
  sessionId: string;
  snapshot: PreparedSnapshot;
  occurredAt: Date;
};

export async function lockShift(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
) {
  const [shift] = await tx
    .select()
    .from(shifts)
    .where(and(eq(shifts.id, shiftId), eq(shifts.businessId, businessId)))
    .for("update")
    .limit(1);
  if (!shift || shift.deletedAt) throw new AccessError("Shift not found.");
  return shift;
}

export async function assertUnreservedShift(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
) {
  await lockShift(tx, businessId, shiftId);
  const [session] = await tx
    .select({ id: offlineShiftSessions.id })
    .from(offlineShiftSessions)
    .where(
      and(
        eq(offlineShiftSessions.businessId, businessId),
        eq(offlineShiftSessions.shiftId, shiftId),
        notInArray(offlineShiftSessions.status, ["closed", "released"]),
      ),
    )
    .limit(1);
  if (session)
    throw new AccessError(
      "This shift belongs to a prepared device. Open its offline workspace to continue, or ask the owner to reconcile the device.",
    );
}

export function runShiftTransaction<T>(
  businessId: string,
  shiftId: string,
  prepared: PreparedOperationContext | undefined,
  work: (tx: OperationalTransaction) => Promise<T>,
): Promise<T> {
  if (prepared) {
    if (
      prepared.snapshot.businessId !== businessId ||
      prepared.snapshot.shiftId !== shiftId
    )
      throw new AccessError("Prepared shift context does not match.");
    return work(prepared.tx);
  }
  return requireDatabase().transaction(async (tx) => {
    await assertUnreservedShift(tx, businessId, shiftId);
    return work(tx);
  });
}

export async function assertProofDevice(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
  userId: string,
) {
  await lockShift(tx, businessId, shiftId);
  const [session] = await tx
    .select()
    .from(offlineShiftSessions)
    .where(
      and(
        eq(offlineShiftSessions.businessId, businessId),
        eq(offlineShiftSessions.shiftId, shiftId),
        notInArray(offlineShiftSessions.status, ["closed", "released"]),
      ),
    )
    .limit(1);
  if (!session) return;
  const { installationId, storageInstallationId } =
    await import("./offline-prepare");
  if (
    session.userId !== userId ||
    session.deviceId !== (await installationId()) ||
    session.status === "recovery" ||
    (session.snapshot as PreparedSnapshot).storageInstallationId !==
      (await storageInstallationId())
  )
    throw new AccessError(
      "Upload this proof from the original prepared device after owner recovery is resolved.",
    );
  return session;
}

export async function assertDeviceCanLeave(userId: string) {
  const { installationId } = await import("./offline-prepare");
  const deviceId = await installationId();
  if (!deviceId) return;
  const [session] = await requireDatabase()
    .select({ id: offlineShiftSessions.id })
    .from(offlineShiftSessions)
    .where(
      and(
        eq(offlineShiftSessions.userId, userId),
        eq(offlineShiftSessions.deviceId, deviceId),
        notInArray(offlineShiftSessions.status, ["closed", "released"]),
      ),
    )
    .limit(1);
  if (session)
    throw new AccessError(
      "Finish and synchronize this device’s prepared shifts before signing out or switching business.",
    );
}
