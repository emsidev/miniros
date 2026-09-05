"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CloudUpload,
  Download,
  FolderClock,
  RefreshCw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncStatus } from "@/lib/offline/device-status";
import { cn } from "@/lib/utils";
import { useDevice } from "./device-context";
import { AppUpdate } from "./app-update";

export function SyncStatusButton({
  inverse = false,
  always = false,
}: {
  inverse?: boolean;
  always?: boolean;
}) {
  const { snapshot, online, error, loading, openPanel } = useDevice();
  const status = syncStatus(snapshot, online, error);
  if (!always && (loading || (status.state === "empty" && online))) return null;
  const Icon =
    status.state === "attention"
      ? CircleAlert
      : status.state === "offline"
        ? WifiOff
        : status.state === "syncing"
          ? RefreshCw
          : status.state === "pending"
            ? CloudUpload
            : Check;
  const label = loading ? "Checking saved work…" : status.label;
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={`Sync status: ${label}`}
      title={label}
      aria-haspopup="dialog"
      onClick={() => openPanel("sync")}
      className={cn(
        "h-11 shrink-0 gap-2 px-3 text-sm",
        inverse && "text-white hover:bg-white/10 hover:text-white",
        !inverse && status.state === "attention" && "text-warning",
        !inverse && status.state === "offline" && "text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4",
          status.state === "syncing" && "motion-safe:animate-spin",
        )}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">
        {status.state === "pending"
          ? snapshot.shifts.reduce(
              (n, row) => n + row.pendingChanges + row.pendingProofs,
              0,
            )
          : status.state === "offline"
            ? "Offline"
            : status.state === "attention"
              ? "Check sync"
              : "Sync"}
      </span>
    </Button>
  );
}

export function DeviceMenuButton() {
  const { openPanel } = useDevice();
  return (
    <Button
      data-device-menu
      type="button"
      variant="ghost"
      aria-haspopup="dialog"
      onClick={() => openPanel("device")}
    >
      <Smartphone aria-hidden="true" />
      <span>This device</span>
    </Button>
  );
}

export function ThisDevice({ heading = true }: { heading?: boolean }) {
  const { openPanel, closePanel } = useDevice();
  return (
    <section className="space-y-3" aria-label="This device">
      {heading ? <h2 className="text-lg font-bold">This device</h2> : null}
      <div className="divide-y rounded-xl border bg-card">
        {(
          [
            { label: "Install app", icon: Download, panel: "install" },
            { label: "Sync status", icon: CloudUpload, panel: "sync" },
          ] as const
        ).map(({ label, icon: Icon, panel }) => (
          <button
            key={panel}
            type="button"
            className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted"
            aria-haspopup="dialog"
            onClick={() => openPanel(panel)}
          >
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            <ArrowRight
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        ))}
        <Link
          href="/offline"
          onClick={closePanel}
          className="flex min-h-14 items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
        >
          <FolderClock
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="flex-1">Saved shifts</span>
          <ArrowRight
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        </Link>
      </div>
      <AppUpdate />
    </section>
  );
}
