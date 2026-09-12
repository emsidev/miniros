import { requireDatabase } from "@miniros/db";
import {
  offlineShiftSessions,
  shifts,
  v2Authorities,
} from "@miniros/db/schema";
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

/** Call while holding the shift row lock. A v2 journal is never reinterpreted by v1. */
export async function assertNoV2Authority(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
) {
  const [authority] = await tx
    .select({ id: v2Authorities.id })
    .from(v2Authorities)
    .where(
      and(
        eq(v2Authorities.businessId, businessId),
        eq(v2Authorities.shiftId, shiftId),
      ),
    )
    .limit(1);
  if (authority)
    throw new AccessError(
      "This shift belongs to a native v2 journal. Continue on its authorized device.",
    );
}

export async function assertUnreservedShift(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
) {
  await lockShift(tx, businessId, shiftId);
  await assertNoV2Authority(tx, businessId, shiftId);
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
      "This shift contains legacy offline work that must be reconciled before it can continue.",
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
  await assertNoV2Authority(tx, businessId, shiftId);
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
