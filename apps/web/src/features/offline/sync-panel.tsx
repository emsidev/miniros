"use client";

import { liveQuery } from "dexie";
import {
  shiftStore,
  cachedIdentity,
  type LocalAction,
  type LocalProof,
} from "@/lib/offline/store";
import {
  pendingLegacyEvidence,
  type LegacyEvidence,
} from "@/lib/offline/legacy-evidence";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  Check,
  CloudUpload,
  FolderClock,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  needsReview,
  syncStatus,
  type DeviceShift,
} from "@/lib/offline/device-status";
import { synchronizePreparedShifts } from "@/lib/offline/sync";
import { useDevice } from "./device-context";

export function SyncPanel({ onClose }: { onClose: () => void }) {
  const { snapshot, online, loading, error, refresh } = useDevice();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const status = syncStatus(snapshot, online, error);
  const hasPending =
    !!snapshot.olderAttachments ||
    snapshot.shifts.some(
      (row) => row.pendingChanges || row.pendingProofs || needsReview(row),
    );
  const canSync =
    !!snapshot.olderAttachments ||
    snapshot.shifts.some(
      ({ session }) =>
        session.status !== "recovery" && session.syncCode !== "CONFLICT",
    );
  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      await synchronizePreparedShifts();
      await refresh();
    } catch {
      setMessage(
        "Couldn't sync. Your work is still saved on this device. Try again when connected.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="py-6 text-sm text-muted-foreground">
        Checking saved work…
      </p>
    );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <p className="font-semibold" role="status" aria-atomic="true">
          {status.label}
        </p>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {online ? (
            <Wifi className="size-4" aria-hidden="true" />
          ) : (
            <WifiOff className="size-4" aria-hidden="true" />
          )}
          {online ? "Connected" : "No connection"}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {snapshot.locked ? (
        <div className="space-y-3">
          <p className="text-sm">
            Sign in to the account that saved these shifts to continue.
          </p>
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button
            variant="ghost"
            disabled={!online || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            Check access again
          </Button>
        </div>
      ) : snapshot.shifts.length ? (
        <ul className="divide-y">
          {snapshot.shifts.map((row) => (
            <SyncShiftRow key={row.session.id} row={row} onClose={onClose} />
          ))}
        </ul>
      ) : !error ? (
        <div className="space-y-3 py-2">
          <FolderClock
            className="size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            Select a shift while connected. Your shift saves automatically on
            this device.
          </p>
          {online ? (
            <Button asChild>
              <Link href="/shifts">Choose a shift</Link>
            </Button>
          ) : (
            <p className="text-sm">Reconnect to choose a shift.</p>
          )}
        </div>
      ) : (
        <Button variant="outline" onClick={refresh}>
          Check again
        </Button>
      )}
      {!snapshot.locked && snapshot.olderAttachments ? (
        <OlderAttachments />
      ) : null}
      {hasPending ? (
        <p className="border-t pt-4 text-xs text-muted-foreground">
          Keep this device’s browser data until all changes and payment proofs
          have synced.
        </p>
      ) : null}
      {snapshot.shifts.length || snapshot.olderAttachments ? (
        <Button
          className="w-full"
          disabled={!online || busy || status.state === "syncing" || !canSync}
          onClick={sync}
        >
          <RefreshCw
            className={busy ? "motion-safe:animate-spin" : ""}
            aria-hidden="true"
          />
          {busy || status.state === "syncing" ? "Syncing…" : "Sync now"}
        </Button>
      ) : null}
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function SyncShiftRow({
  row,
  onClose,
}: {
  row: DeviceShift;
  onClose: () => void;
}) {
  const { session, pendingChanges, pendingProofs, proofError } = row;
  const attention = session.syncError ?? session.lastError ?? proofError;
  return (
    <li className="space-y-3 py-4 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold">
            {session.snapshot.locationName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {session.snapshot.businessName} · {session.snapshot.shiftDate}
          </p>
        </div>
        <Button
          asChild
          variant="ghost"
          className="shrink-0 px-2"
          onClick={onClose}
        >
          <Link href={`/offline?session=${encodeURIComponent(session.id)}`}>
            Open shift
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Transactions pending</dt>
        <dd className="text-right font-medium tabular-nums">
          {pendingChanges}
        </dd>
        <dt className="text-muted-foreground">Attachments</dt>
        <dd className="text-right font-medium tabular-nums">
          {pendingProofs ? `${pendingProofs} pending` : "None pending"}
        </dd>
        <dt className="text-muted-foreground">Last synced</dt>
        <dd className="text-right text-xs">
          {session.lastSyncAt
            ? new Date(session.lastSyncAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "Not yet"}
        </dd>
      </dl>
      {session.status === "recovery" || session.syncCode === "CONFLICT" ? (
        <p className="text-sm text-destructive">
          This shift needs owner recovery. Keep the original device and
          receipts; ask your owner to review it in Settings.
        </p>
      ) : needsReview(row) ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <CloudUpload className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Closeout saved. Final results wait for sync, payment proofs, and any
          owner review.
        </p>
      ) : session.status === "closed" ? (
        <p className="flex items-center gap-2 text-xs text-success">
          <Check className="size-4" aria-hidden="true" />
          Shift closed and confirmed
        </p>
      ) : null}
      <UploadRecords session={session} />
      {attention ? (
        <p role="alert" className="text-sm text-destructive">
          {attention}
        </p>
      ) : null}
    </li>
  );
}
const actionLabels: Record<string, string> = {
  START_SHIFT: "Opening count",
  CREATE_SALE: "Sale",
  CREATE_CASH_DEDUCTION: "Expense",
  CREATE_INVENTORY_ADJUSTMENT: "Stock adjustment",
  SUBMIT_CLOSEOUT: "Closeout",
};
function UploadRecords({ session }: { session: DeviceShift["session"] }) {
  const [records, setRecords] = useState<{
    actions: LocalAction[];
    proofs: LocalProof[];
    legacy: LegacyEvidence[];
  }>({ actions: [], proofs: [], legacy: [] });
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const db = shiftStore(),
        identity = await cachedIdentity(db);
      if (
        identity?.businessId !== session.snapshot.businessId ||
        identity.userId !== session.snapshot.userId ||
        identity.deviceId !== session.deviceId
      )
        return { actions: [], proofs: [], legacy: [] };
      return {
        actions: (
          await db.shiftActions.where("sessionId").equals(session.id).toArray()
        ).sort((a, b) => a.sequence - b.sequence),
        proofs: await db.proofs.where("sessionId").equals(session.id).toArray(),
        legacy: (await pendingLegacyEvidence(identity)).filter(
          (row) => row.shiftId === session.snapshot.shiftId,
        ),
      };
    }).subscribe({ next: setRecords });
    return () => subscription.unsubscribe();
  }, [
    session.id,
    session.snapshot.businessId,
    session.snapshot.userId,
    session.snapshot.shiftId,
    session.deviceId,
  ]);
  return (
    <details className="border-y">
      <summary className="flex min-h-12 cursor-pointer items-center py-3 text-sm font-semibold">
        Transaction & attachment details
      </summary>
      <section className="pb-4" aria-label="Financial transactions">
        <h3 className="py-2 text-sm font-bold">
          Transactions · uploaded in order
        </h3>
        <ul className="divide-y text-sm">
          {records.actions.slice(-20).map((action) => (
            <li key={action.id} className="flex justify-between gap-3 py-3">
              <span>
                #{action.sequence}{" "}
                {actionLabels[action.operation.type] ?? action.operation.type}
              </span>
              <span>
                {action.status === "synced" ? "Uploaded" : "Saved locally"}
              </span>
            </li>
          ))}
        </ul>
        {!records.actions.length ? (
          <p className="text-sm text-muted-foreground">
            No transactions recorded.
          </p>
        ) : null}
        <h3 className="pt-4 pb-2 text-sm font-bold">
          Attachments · retried separately
        </h3>
        <p className="pb-2 text-xs text-muted-foreground">
          Upload trouble does not stop New sale. Final closeout waits for
          required evidence.
        </p>
        <ul className="divide-y text-sm">
          {[
            ...records.proofs.map((proof) => ({
              id: proof.id,
              name: proof.file.name,
              uploaded: !!proof.synced,
              error: proof.error,
            })),
            ...records.legacy.map((row) => ({
              id: row.id,
              name: row.file.name,
              uploaded: false,
              error: row.error,
            })),
          ].map((row) => (
            <li key={row.id} className="py-3">
              <div className="flex justify-between gap-3">
                <span className="break-all">{row.name}</span>
                <span className="shrink-0">
                  {row.uploaded ? "Uploaded" : "Saved locally"}
                </span>
              </div>
              {row.error ? (
                <p className="mt-2 text-destructive">
                  {row.error} Reconnect and use Sync now to retry this upload.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {!records.proofs.length && !records.legacy.length ? (
          <p className="text-sm text-muted-foreground">
            No attachments recorded.
          </p>
        ) : null}
      </section>
    </details>
  );
}
function OlderAttachments() {
  const [rows, setRows] = useState<LegacyEvidence[]>([]);
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const pending = await pendingLegacyEvidence(),
        identity = await cachedIdentity();
      if (!identity) return [];
      const sessions = await shiftStore()
        .sessions.filter(
          (session) =>
            session.snapshot.businessId === identity.businessId &&
            session.snapshot.userId === identity.userId &&
            session.status !== "released",
        )
        .toArray();
      return pending.filter(
        (row) =>
          !sessions.some((session) => session.snapshot.shiftId === row.shiftId),
      );
    }).subscribe({ next: setRows });
    return () => subscription.unsubscribe();
  }, []);
  return (
    <section className="space-y-3 border-t pt-4">
      <h2 className="text-sm font-bold">Older shift attachments</h2>
      <p className="text-xs text-muted-foreground">
        These photos are saved locally. Sync now retries them separately from
        transactions.
      </p>
      <ul className="divide-y text-sm">
        {rows.map((row) => (
          <li key={row.id} className="py-3">
            <p className="break-all">{row.file.name}</p>
            {row.error ? (
              <p className="mt-2 text-destructive">
                {row.error} Reconnect and retry.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
