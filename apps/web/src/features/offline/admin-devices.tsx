"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deviceNeedsAttention,
  deviceStatusLabel,
  journalActionLabel,
  type AdminDeviceSession,
  type DeviceJournalEntry,
} from "@/lib/offline/admin-devices";
import { recoverOfflineDeviceAction } from "@/server/actions/offline";

export function Devices({
  sessions,
  selectedId,
  journal,
}: {
  sessions: AdminDeviceSession[];
  selectedId?: string;
  journal: DeviceJournalEntry[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [refreshing, transition] = useTransition();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const refreshButton = useRef<HTMLButtonElement | null>(null);
  const selected = sessions.find((session) => session.id === selectedId);
  const attention = sessions.filter(deviceNeedsAttention);
  const visible = filter === "attention" ? attention : sessions;
  const open = (id: string) =>
    transition(() =>
      router.push(`/admin/devices?session=${id}`, { scroll: false }),
    );
  const close = () => router.push("/admin/devices", { scroll: false });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Shift devices across all your locations."
        action={
          <Button
            ref={refreshButton}
            variant="outline"
            disabled={refreshing}
            onClick={() => transition(() => router.refresh())}
          >
            <RefreshCw
              className={cn(refreshing && "motion-safe:animate-spin")}
              aria-hidden="true"
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>Offline support is automatic at every location.</p>
      </div>
      {sessions.length ? (
        <>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Filter shift devices"
          >
            <Button
              variant={filter === "all" ? "default" : "outline"}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All <span className="tabular-nums">{sessions.length}</span>
            </Button>
            <Button
              variant={filter === "attention" ? "default" : "outline"}
              aria-pressed={filter === "attention"}
              onClick={() => setFilter("attention")}
            >
              Needs attention{" "}
              <span className="tabular-nums">{attention.length}</span>
            </Button>
          </div>
          <section
            className="overflow-hidden rounded-xl border bg-card"
            aria-label="Shift devices"
            aria-busy={refreshing}
          >
            <div
              className="hidden grid-cols-[1.1fr_1.5fr_1fr_1fr_44px] gap-4 border-b bg-muted/50 px-5 py-3 text-xs font-semibold text-muted-foreground lg:grid"
              aria-hidden="true"
            >
              <span>Operator / device</span>
              <span>Location / shift</span>
              <span>Status</span>
              <span>Last acknowledged</span>
              <span />
            </div>
            <ul className="divide-y">
              {visible.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={(event) => {
                      trigger.current = event.currentTarget;
                      open(session.id);
                    }}
                    aria-label={`View device for ${session.operator}, ${session.title}, ${formatDate(session.shiftDate)}`}
                    className="grid w-full min-w-0 gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5 lg:grid-cols-[1.1fr_1.5fr_1fr_1fr_44px] lg:items-center lg:gap-4"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Smartphone
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">
                          {session.operator}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {session.deviceLabel}
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-semibold">
                        {session.locationName}
                      </span>
                      <span className="mt-1 block break-words text-xs text-muted-foreground">
                        {session.title !== session.locationName
                          ? `${session.title} · `
                          : ""}
                        {formatDate(session.shiftDate)}
                      </span>
                    </span>
                    <span>
                      <DeviceBadge session={session} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="lg:hidden">Last acknowledged: </span>
                      {session.lastAcknowledgedAt
                        ? formatDateTime(session.lastAcknowledgedAt)
                        : "No activity received yet"}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium lg:justify-end">
                      <span className="lg:sr-only">View details</span>
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!visible.length ? (
              <p role="status" className="p-6 text-sm text-muted-foreground">
                No devices need attention.
              </p>
            ) : null}
          </section>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Activity shown here has reached MINIROS. A disconnected device may
            have additional sales or changes waiting to sync.
          </p>
        </>
      ) : (
        <section className="rounded-xl border bg-card px-5 py-12 text-center">
          <Smartphone
            className="mx-auto mb-4 size-8 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-lg font-bold">No shift devices yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Devices appear automatically when an operator opens Start shift.
          </p>
        </section>
      )}
      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) close();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl [&>[data-slot=dialog-close]]:size-11"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (trigger.current?.isConnected
              ? trigger.current
              : refreshButton.current
            )?.focus();
          }}
        >
          <DialogHeader className="pr-8">
            <DialogTitle>
              {selected?.locationName ?? "Device unavailable"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${selected.operator} · ${formatDate(selected.shiftDate)} · ${selected.deviceLabel}`
                : "This device assignment is complete or isn't available in this business."}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <DeviceDetails
              key={selected.id}
              session={selected}
              journal={journal}
            />
          ) : (
            <Button variant="outline" onClick={close}>
              Back to devices
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeviceBadge({ session }: { session: AdminDeviceSession }) {
  const attention = deviceNeedsAttention(session);
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-normal text-left",
        attention && "border-transparent bg-warning-surface text-warning",
      )}
    >
      {attention ? (
        <CircleAlert className="size-3.5" aria-hidden="true" />
      ) : null}
      {deviceStatusLabel(session)}
    </Badge>
  );
}

function DeviceDetails({
  session,
  journal,
}: {
  session: AdminDeviceSession;
  journal: DeviceJournalEntry[];
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<"freeze" | "restore">();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, transition] = useTransition();
  const actionTitle = useRef<HTMLHeadingElement | null>(null);
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DeviceBadge session={session} />
        <Button asChild variant="ghost">
          <Link href={`/admin/shifts/${session.shiftId}`}>
            View shift
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      {session.lastError ? (
        <p className="rounded-lg bg-warning-surface p-3 text-sm text-warning">
          {session.lastError}
        </p>
      ) : null}
      <section className="space-y-3" aria-label="Acknowledged activity">
        <h3 className="font-semibold">Activity received by MINIROS</h3>
        <p className="text-sm text-muted-foreground">
          {session.acknowledgedSequence} acknowledged{" "}
          {session.acknowledgedSequence === 1 ? "action" : "actions"}. Sales
          still on the device won’t appear here until they sync.
        </p>
        {journal.length ? (
          <ol className="divide-y rounded-lg border">
            {journal.map((entry, index) => (
              <li
                key={`${entry.sequence}:${index}`}
                className="min-w-0 space-y-2 p-3 sm:p-4"
              >
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {entry.sequence}. {journalActionLabel(entry.actionType)}
                  </span>
                  <span className="text-muted-foreground">
                    {entry.status === "synced"
                      ? "Acknowledged"
                      : "Needs review"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.syncedAt ?? entry.createdAt)}
                </p>
                {entry.errorMessage ? (
                  <p className="break-words text-sm text-destructive">
                    {entry.errorMessage}
                  </p>
                ) : null}
                <details className="min-w-0 text-xs text-muted-foreground">
                  <summary className="flex min-h-11 cursor-pointer items-center font-medium">
                    Technical details
                  </summary>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3">
                    {JSON.stringify(
                      {
                        payload: entry.payload,
                        result: entry.result,
                        conflictCode: entry.conflictCode,
                        digest: entry.payloadDigest,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border px-4 py-5 text-sm text-muted-foreground">
            No activity has reached MINIROS yet.
          </p>
        )}
      </section>
      <div className="space-y-3 border-t pt-4">
        <Dialog
          open={Boolean(decision)}
          onOpenChange={(isOpen) => {
            if (!isOpen && !busy) setDecision(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() => {
                setDecision(
                  session.status === "recovery" ? "restore" : "freeze",
                );
                setMessage("");
                setError("");
              }}
            >
              {session.status === "recovery"
                ? "Restore original device"
                : "Freeze device"}
            </Button>
          </DialogTrigger>
          <DialogContent
            overlayClassName="z-[calc(var(--mi-z-modal)+1)]"
            className="z-[calc(var(--mi-z-modal)+2)] max-h-[90dvh] overflow-y-auto [&>[data-slot=dialog-close]]:size-11"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              actionTitle.current?.focus();
            }}
          >
            <DialogHeader className="pr-8">
              <DialogTitle ref={actionTitle} tabIndex={-1}>
                {decision === "freeze"
                  ? "Freeze this device?"
                  : "Restore the original device?"}
              </DialogTitle>
              <DialogDescription>
                {decision === "freeze"
                  ? "Freeze access while you compare this activity with receipts on the original device. A disconnected device receives the freeze when it reconnects. Saved sales are preserved and ownership stays with this device."
                  : "Restore access only after recovering the original device and comparing its saved receipts with this activity. This does not move the shift to another device."}
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!decision || busy) return;
                setError("");
                transition(async () => {
                  const result = await recoverOfflineDeviceAction({
                    sessionId: session.id,
                    decision,
                    reason,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setDecision(undefined);
                  setReason("");
                  setMessage("Device access updated.");
                  router.refresh();
                });
              }}
            >
              <p className="text-sm text-muted-foreground">
                If the device is permanently lost, its unsynchronized sales need
                manual reconciliation before final profit can be trusted.
              </p>
              <div className="space-y-2">
                <Label htmlFor="recovery-note">Recovery note</Label>
                <Textarea
                  id="recovery-note"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  disabled={busy}
                  aria-describedby="recovery-note-hint"
                />
                <p
                  id="recovery-note-hint"
                  className="text-xs text-muted-foreground"
                >
                  Describe the issue and what you checked (at least 10
                  characters).
                </p>
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || reason.trim().length < 10}>
                  {busy
                    ? "Saving…"
                    : decision === "freeze"
                      ? "Freeze device"
                      : "Restore original device"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setDecision(undefined)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
