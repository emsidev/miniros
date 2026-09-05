import {
  cachedIdentity,
  shiftStore,
  visibleSessions,
  type LocalSession,
} from "./store";

export type DeviceShift = {
  session: LocalSession;
  pendingChanges: number;
  pendingProofs: number;
  proofError?: string;
};
export type DeviceSnapshot = { shifts: DeviceShift[]; locked: boolean };
export type SyncState =
  "attention" | "offline" | "syncing" | "pending" | "ready" | "empty";

/** Read one account-scoped snapshot; proof files never leave IndexedDB here. */
export async function readDeviceSnapshot(
  db = shiftStore(),
): Promise<DeviceSnapshot> {
  return db.transaction("r", db.meta, db.sessions, db.proofs, async () => {
    if (!(await cachedIdentity(db))) {
      return { shifts: [], locked: (await db.sessions.count()) > 0 };
    }
    const sessions = await visibleSessions(db);
    const shifts = await Promise.all(
      sessions.map(async (session) => {
        const proofs = await db.proofs
          .where("sessionId")
          .equals(session.id)
          .filter((proof) => proof.synced === 0)
          .toArray();
        return {
          session,
          pendingChanges: Math.max(
            0,
            session.nextSequence - 1 - session.acknowledgedSequence,
          ),
          pendingProofs: proofs.length,
          proofError: proofs.find((proof) => proof.error)?.error,
        };
      }),
    );
    return { shifts, locked: false };
  });
}

export function needsReview({ session }: DeviceShift) {
  return (
    session.status === "recovery" ||
    (session.projection.state === "closing" && session.status !== "closed")
  );
}

export function syncStatus(
  snapshot: DeviceSnapshot,
  online: boolean,
  error?: string,
): { state: SyncState; label: string } {
  const { shifts, locked } = snapshot;
  if (
    locked ||
    error ||
    shifts.some(
      (row) =>
        row.session.syncError ||
        row.session.lastError ||
        row.proofError ||
        row.session.syncCode === "AUTH" ||
        row.session.syncCode === "CONFLICT" ||
        needsReview(row),
    )
  ) {
    return { state: "attention", label: "Needs attention" };
  }
  if (!online) return { state: "offline", label: "Offline" };
  if (shifts.some((row) => row.session.syncCode === "SYNCING"))
    return { state: "syncing", label: "Syncing…" };
  const changes = shifts.reduce((count, row) => count + row.pendingChanges, 0);
  const proofs = shifts.reduce((count, row) => count + row.pendingProofs, 0);
  if (changes)
    return {
      state: "pending",
      label: `${changes} ${changes === 1 ? "change" : "changes"} pending`,
    };
  if (proofs)
    return {
      state: "pending",
      label: `${proofs} ${proofs === 1 ? "proof" : "proofs"} pending`,
    };
  if (!shifts.length) return { state: "empty", label: "No saved shifts" };
  // A prepared but unused shift has nothing to acknowledge yet.
  if (shifts.every((row) => row.session.acknowledgedSequence === 0)) {
    return { state: "ready", label: "Saved on device" };
  }
  return { state: "ready", label: "Up to date" };
}

export function legacyDeviceUrl(panel: "install" | "sync", session?: string) {
  const params = new URLSearchParams({ panel });
  if (session) params.set("session", session);
  return `/offline?${params}`;
}
