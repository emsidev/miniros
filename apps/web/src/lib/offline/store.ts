import Dexie, { type Table } from "dexie";
import {
  emptyShiftProjection,
  calculatePreparedSale,
  offlineEnvelopeSchema,
  offlineOperationSchema,
  projectOfflineOperation,
  type LocalShiftProjection,
  type OfflineEnvelope,
  type OfflineOperation,
  type PreparedShift,
} from "@miniros/contracts";

export type LocalSession = PreparedShift & {
  projection: LocalShiftProjection;
  nextSequence: number;
  lastSyncAt?: string;
  lastServerContactAt?: string;
  syncError?: string;
  syncCode?: string;
};
export type LocalAction = OfflineEnvelope & {
  status: "pending" | "synced";
  result?: Record<string, unknown>;
};
export type LocalProof = {
  id: string;
  sessionId: string;
  paymentId?: string;
  saleId?: string;
  file: File;
  synced: number;
  error?: string;
};
export type LocalIdentity = {
  userId: string;
  businessId: string;
  deviceId: string | null;
};

export class ShiftStore extends Dexie {
  sessions!: Table<LocalSession, string>;
  shiftActions!: Table<LocalAction, string>;
  proofs!: Table<LocalProof, string>;
  drafts!: Table<{ id: string; value: unknown }, string>;
  meta!: Table<{ id: string; value: unknown }, string>;
  constructor(name = "miniros-prepared-shifts") {
    super(name);
    this.version(1).stores({
      sessions: "&id, snapshot.businessId, snapshot.userId",
      shiftActions: "&id, &[sessionId+sequence], sessionId, status",
      proofs: "&id, sessionId, synced",
      drafts: "&id",
      meta: "&id",
    });
  }
}
let instance: ShiftStore | undefined;
export const shiftStore = () => (instance ??= new ShiftStore());
export function offlineChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("miniros-offline-change"));
}

export async function localInstallationId(db = shiftStore()) {
  return db.transaction("rw", db.meta, async () => {
    const current = (await db.meta.get("storageInstallationId"))?.value as
      string | undefined;
    if (current) return current;
    const id = crypto.randomUUID();
    await db.meta.put({ id: "storageInstallationId", value: id });
    return id;
  });
}

export async function cachedIdentity(
  db = shiftStore(),
): Promise<LocalIdentity | undefined> {
  return (await db.meta.get("identity"))?.value as LocalIdentity | undefined;
}
export async function visibleSessions(db = shiftStore()) {
  const identity = await cachedIdentity(db);
  if (!identity) return [];
  return db.sessions
    .filter(
      (s) =>
        s.snapshot.userId === identity.userId &&
        s.snapshot.businessId === identity.businessId &&
        s.deviceId === identity.deviceId &&
        s.status !== "released",
    )
    .toArray();
}
export async function savePreparedShift(
  session: PreparedShift,
  identity: LocalIdentity,
  db = shiftStore(),
) {
  if (
    session.snapshot.userId !== identity.userId ||
    session.snapshot.businessId !== identity.businessId ||
    session.deviceId !== identity.deviceId
  )
    throw new Error("Prepared shift does not match the signed-in account.");
  if (
    session.snapshot.storageInstallationId !== (await localInstallationId(db))
  )
    throw new Error(
      "Prepare this shift inside the app or browser you will use to sell. Another storage container owns its saved work.",
    );
  await db.transaction("rw", db.sessions, db.meta, async () => {
    const existing = await db.sessions.get(session.id);
    if (existing) {
      await db.sessions.update(session.id, {
        status: session.status,
        acknowledgedSequence: session.acknowledgedSequence,
        lastError: session.lastError,
      });
    } else {
      // A missing local database with server activity is data recovery, never a new blank shift.
      if (session.acknowledgedSequence > 0 || session.status !== "prepared")
        throw new Error(
          "Local shift data is missing. Ask the owner to recover this device; do not start a replacement shift.",
        );
      await db.sessions.add({
        ...session,
        nextSequence: 1,
        projection: emptyShiftProjection(),
      });
    }
    await db.meta.put({ id: "identity", value: identity });
  });
  offlineChanged();
}

export async function appendShiftAction(
  sessionId: string,
  operation: OfflineOperation,
  actionId = crypto.randomUUID(),
  files: LocalProof[] = [],
  db = shiftStore(),
) {
  operation = offlineOperationSchema.parse(operation);
  const action = await db.transaction(
    "rw",
    db.sessions,
    db.shiftActions,
    db.proofs,
    db.meta,
    db.drafts,
    async () => {
      const identity = await cachedIdentity(db);
      const session = await db.sessions.get(sessionId);
      if (
        !session ||
        !identity ||
        session.snapshot.userId !== identity.userId ||
        session.snapshot.businessId !== identity.businessId ||
        session.deviceId !== identity.deviceId
      )
        throw new Error("Open the prepared account before recording work.");
      const existing = await db.shiftActions.get(actionId);
      if (existing) {
        if (
          existing.sessionId !== sessionId ||
          JSON.stringify(existing.operation) !== JSON.stringify(operation)
        )
          throw new Error(
            "This request already represents different work. Retrieve the saved sale before retrying.",
          );
        return existing;
      }
      if (["recovery", "released", "closed"].includes(session.status))
        throw new Error(
          "This device requires owner reconciliation before more work can be recorded.",
        );
      const envelope = offlineEnvelopeSchema.parse({
        schemaVersion: session.snapshot.schemaVersion,
        id: actionId,
        sessionId,
        snapshotId: session.snapshot.id,
        sequence: session.nextSequence,
        occurredAt: new Date().toISOString(),
        operation,
      });
      if (envelope.operation.type === "CREATE_SALE") {
        for (const proof of envelope.operation.proofs) {
          const local = files.find(
            (f) =>
              f.id === proof.fileId &&
              f.paymentId === proof.paymentId &&
              f.sessionId === sessionId,
          );
          if (
            !local ||
            local.file.size !== proof.size ||
            local.file.type !== proof.mimeType ||
            local.file.name !== proof.name
          )
            throw new Error(
              "A payment proof is missing. Attach it again before completing this sale.",
            );
        }
      }
      const projection = projectOfflineOperation(
        session.snapshot,
        session.projection,
        envelope.operation,
      );
      const row: LocalAction = { ...envelope, status: "pending" };
      await db.shiftActions.add(row);
      if (
        envelope.operation.type === "CREATE_SALE" &&
        envelope.operation.discountProof
      ) {
        const declared = envelope.operation.discountProof;
        const saleId = envelope.operation.payload.saleId;
        const photo = files.find(
          (f) =>
            f.id === declared.fileId &&
            f.saleId === saleId &&
            f.sessionId === sessionId,
        );
        if (
          !photo ||
          photo.file.size !== declared.size ||
          photo.file.type !== declared.mimeType ||
          photo.file.name !== declared.name
        )
          throw new Error(
            "The promo photo is missing. Attach it again before completing this sale.",
          );
      }
      for (const proof of files) await db.proofs.add(proof);
      await db.sessions.update(sessionId, {
        projection,
        nextSequence: session.nextSequence + 1,
      });
      if (operation.type === "CREATE_SALE") {
        const key = `pos:${sessionId}`;
        const previous = (await db.drafts.get(key))?.value as
          Record<string, unknown> | undefined;
        const saved = calculatePreparedSale(session.snapshot, operation);
        const receipt = {
          saleId: saved.saleId,
          totalCents: saved.totalCents,
          amountPaidCents: saved.amountPaidCents,
          changeCents: saved.changeCents,
          savedLocally: true,
          pendingProofs: [],
          payments: operation.payload.payments.map((payment) => ({
            id: payment.id,
            method: payment.paymentMethod,
            amountCents: payment.amountCents,
            reference: payment.referenceNumber ?? "",
            proofFileId:
              operation.proofs.find((p) => p.paymentId === payment.id)
                ?.fileId ?? payment.id,
            file:
              files.find((file) => file.paymentId === payment.id)?.file ?? null,
          })),
        };
        await db.drafts.put({
          id: key,
          value: {
            ...previous,
            cart: previous?.cart ?? {},
            payments: previous?.payments ?? [],
            saleRequestId: actionId,
            receipt,
            frozen: operation.payload,
          },
        });
      }
      if (operation.type === "START_SHIFT")
        await db.drafts.delete(`counts:${sessionId}:start`);
      if (operation.type === "SUBMIT_CLOSEOUT")
        await db.drafts.delete(`counts:${sessionId}:close`);
      if (operation.type === "CREATE_CASH_DEDUCTION")
        await db.drafts.delete(`request:${sessionId}:cash`);
      if (operation.type === "CREATE_INVENTORY_ADJUSTMENT")
        await db.drafts.delete(`request:${sessionId}:inventory`);
      return row;
    },
  );
  offlineChanged();
  return action;
}

/** Updates must not swap the shell while any local work is unfinished. */
export async function guardLocalExit() {
  const db = shiftStore();
  if (
    await db.sessions
      .filter((s) => !["closed", "released"].includes(s.status))
      .count()
  )
    throw new Error(
      "Synchronize and close or release prepared shifts before updating.",
    );
  if (await db.proofs.where("synced").equals(0).count())
    throw new Error("Upload pending payment proofs before updating.");
  if (await db.drafts.count())
    throw new Error("Resolve saved checkout drafts before updating.");
}

/** Test-fixture cleanup only. Account exit preserves journals and drafts. */
export async function clearLocalAccount() {
  if (process.env.NODE_ENV !== "test")
    throw new Error("Local journals cannot be erased by account exit.");
  const db = shiftStore();
  await db.transaction(
    "rw",
    [db.sessions, db.shiftActions, db.proofs, db.drafts, db.meta],
    async () => {
      await Promise.all([
        db.sessions.clear(),
        db.shiftActions.clear(),
        db.proofs.clear(),
        db.drafts.clear(),
        db.meta.clear(),
      ]);
    },
  );
  offlineChanged();
}
