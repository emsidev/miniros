"use client";

import Link from "next/link";
import { useState } from "react";
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
  const hasPending = snapshot.shifts.some(
    (row) => row.pendingChanges || row.pendingProofs || needsReview(row),
  );
  const canSync = snapshot.shifts.some(
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
            Open Start shift while connected. Your shift saves automatically on
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
      {hasPending ? (
        <p className="border-t pt-4 text-xs text-muted-foreground">
          Keep this device’s browser data until all changes and payment proofs
          have synced.
        </p>
      ) : null}
      {snapshot.shifts.length ? (
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
        <dt className="text-muted-foreground">Changes pending</dt>
        <dd className="text-right font-medium tabular-nums">
          {pendingChanges}
        </dd>
        <dt className="text-muted-foreground">Payment proofs</dt>
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
      {attention ? (
        <p role="alert" className="text-sm text-destructive">
          {attention}
        </p>
      ) : null}
    </li>
  );
}
