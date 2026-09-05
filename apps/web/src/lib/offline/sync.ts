import {
  offlineEnvelopeSchema,
  type PreparedShift,
  type SyncReply,
} from "@miniros/contracts";
import {
  cachedIdentity,
  localInstallationId,
  offlineChanged,
  shiftStore,
  visibleSessions,
  type LocalIdentity,
} from "./store";

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init?.headers).entries()),
      "x-miniros-storage": await localInstallationId(),
    },
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(body.error ?? "The server is unavailable."), {
      code: body.code ?? "RETRY",
    });
  return body;
}

export async function refreshOfflineIdentity() {
  const db = shiftStore();
  const identity = (await request("/api/offline/status")) as LocalIdentity & {
    sessions: PreparedShift[];
  };
  const old = await cachedIdentity();
  if (
    old &&
    (old.userId !== identity.userId ||
      old.businessId !== identity.businessId ||
      old.deviceId !== identity.deviceId)
  ) {
    await db.meta.delete("identity");
    offlineChanged();
    throw Object.assign(
      new Error(
        "The account changed. Sign back in to the prepared account to recover its work.",
      ),
      { code: "AUTH" },
    );
  }
  await db.meta.put({
    id: "identity",
    value: {
      userId: identity.userId,
      businessId: identity.businessId,
      deviceId: identity.deviceId,
    },
  });
  for (const server of identity.sessions) {
    if (await db.sessions.get(server.id))
      await db.sessions.update(server.id, {
        status: server.status,
        lastError: server.lastError,
        lastServerContactAt: new Date().toISOString(),
      });
  }
  return identity;
}

let running: Promise<void> | undefined;
export function synchronizePreparedShifts() {
  running ??= synchronize().finally(() => {
    running = undefined;
    offlineChanged();
  });
  return running;
}

async function synchronize() {
  if (!navigator.onLine) return;
  const db = shiftStore();
  const leaseId = crypto.randomUUID();
  const claimed = await db.transaction("rw", db.meta, async () => {
    const lease = (await db.meta.get("syncLease"))?.value as
      { expires: number } | undefined;
    if (lease && lease.expires > Date.now()) return false;
    await db.meta.put({
      id: "syncLease",
      value: { id: leaseId, expires: Date.now() + 60000 },
    });
    return true;
  });
  if (!claimed) return;
  const renew = () =>
    db.meta.put({
      id: "syncLease",
      value: { id: leaseId, expires: Date.now() + 60000 },
    });
  try {
    await refreshOfflineIdentity();
    for (const session of await visibleSessions()) {
      if (
        ["recovery", "released"].includes(session.status) ||
        session.syncCode === "CONFLICT"
      )
        continue;
      const actions = await db.shiftActions
        .where("sessionId")
        .equals(session.id)
        .sortBy("sequence");
      await db.sessions.update(session.id, {
        syncError: undefined,
        syncCode: "SYNCING",
      });
      offlineChanged();
      try {
        // Upload already-acknowledged sale proofs before attempting its closeout barrier.
        const uploadProofs = async () => {
          for (const proof of await db.proofs
            .where("sessionId")
            .equals(session.id)
            .filter((p) => p.synced === 0)
            .toArray()) {
            const sale = actions.find(
              (a) =>
                a.operation.type === "CREATE_SALE" &&
                (a.operation.proofs.some((p) => p.fileId === proof.id) ||
                  a.operation.discountProof?.fileId === proof.id),
            );
            if (
              !sale ||
              (await db.shiftActions.get(sale.id))?.status !== "synced"
            )
              continue;
            await renew();
            const form = new FormData();
            if (proof.saleId) form.set("saleId", proof.saleId);
            else form.set("paymentId", proof.paymentId!);
            form.set("fileId", proof.id);
            const declared =
              sale.operation.type === "CREATE_SALE"
                ? proof.saleId
                  ? sale.operation.discountProof
                  : sale.operation.proofs.find((p) => p.fileId === proof.id)
                : undefined;
            form.set("file", proof.file, declared?.name ?? proof.file.name);
            try {
              await request("/api/offline/proof", {
                method: "POST",
                body: form,
              });
              await db.proofs.update(proof.id, { synced: 1, error: undefined });
            } catch (error) {
              await db.proofs.update(proof.id, {
                error: error instanceof Error ? error.message : "Upload failed",
              });
              throw error;
            }
          }
        };
        await uploadProofs();
        for (const action of actions) {
          if (action.status === "synced") continue;
          await renew();
          const envelope = offlineEnvelopeSchema.parse({
            schemaVersion: action.schemaVersion,
            id: action.id,
            sessionId: action.sessionId,
            snapshotId: action.snapshotId,
            sequence: action.sequence,
            occurredAt: action.occurredAt,
            operation: action.operation,
          });
          const reply = (await request("/api/offline/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(envelope),
          })) as SyncReply;
          if (!reply.ok)
            throw Object.assign(new Error(reply.error), { code: reply.code });
          await db.transaction("rw", db.shiftActions, db.sessions, async () => {
            await db.shiftActions.update(action.id, {
              status: "synced",
              result: reply.result,
            });
            await db.sessions.update(session.id, {
              status: reply.sessionStatus,
              acknowledgedSequence: reply.sequence,
              lastSyncAt: new Date().toISOString(),
              syncError: undefined,
              syncCode: undefined,
            });
          });
          await uploadProofs();
          offlineChanged();
        }
        await db.sessions.update(session.id, {
          syncCode: undefined,
          syncError: undefined,
        });
      } catch (error) {
        await db.sessions.update(session.id, {
          syncCode: (error as { code?: string }).code ?? "RETRY",
          syncError:
            error instanceof Error
              ? error.message
              : "Synchronization interrupted. Your work is saved on this device.",
        });
      }
    }
  } catch (error) {
    const code = (error as { code?: string }).code ?? "RETRY";
    for (const session of await visibleSessions())
      await db.sessions.update(session.id, {
        syncCode: code,
        syncError:
          error instanceof Error ? error.message : "Server unavailable",
      });
    // Revalidation failure locks cached records; a network error does not erase offline work.
    if (code === "AUTH") await db.meta.delete("identity");
  } finally {
    await db.transaction("rw", db.meta, async () => {
      const lease = (await db.meta.get("syncLease"))?.value as
        { id: string } | undefined;
      if (lease?.id === leaseId) await db.meta.delete("syncLease");
    });
  }
}
