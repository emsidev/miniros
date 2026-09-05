"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { DevicePanel } from "./device-context";
import { ThisDevice } from "./device-controls";
import { AppInstall } from "./app-install";
import { SyncPanel } from "./sync-panel";

export function DevicePanels({
  panel,
  onPanelChange,
  onClose,
  restoreFocus,
}: {
  panel?: DevicePanel;
  onPanelChange: (panel: DevicePanel) => void;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const [lastPanel, setLastPanel] = useState<DevicePanel>("device");
  useEffect(() => {
    if (panel) setLastPanel(panel);
  }, [panel]);
  const displayedPanel = panel ?? lastPanel;
  return (
    <Dialog
      open={Boolean(panel)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="top-auto bottom-0 max-h-[90dvh] max-w-full translate-y-0 overflow-y-auto rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-xl sm:p-6 [&>[data-slot=dialog-close]]:size-11"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <DialogHeader className="pr-10">
          {displayedPanel !== "device" ? (
            <Button
              variant="ghost"
              className="-ml-2 w-fit px-2 text-xs text-muted-foreground"
              onClick={() => onPanelChange("device")}
            >
              <ArrowLeft aria-hidden="true" />
              This device
            </Button>
          ) : null}
          <DialogTitle className="text-xl font-bold">
            {displayedPanel === "install"
              ? "Install app"
              : displayedPanel === "sync"
                ? "Sync status"
                : "This device"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {displayedPanel === "install"
              ? "Add MINIROS to your device."
              : displayedPanel === "sync"
                ? "Saved shifts and changes waiting for server confirmation."
                : "Installation, saved shifts, and app updates."}
          </DialogDescription>
        </DialogHeader>
        {displayedPanel === "install" ? (
          <AppInstall />
        ) : displayedPanel === "sync" ? (
          <SyncPanel onClose={onClose} />
        ) : (
          <ThisDevice heading={false} />
        )}
      </DialogContent>
    </Dialog>
  );
}
