"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activateAppUpdate } from "@/lib/offline/app-update";

export function AppUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let stopped = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null | undefined;
    const changed = () => {
      if (!stopped) setWaiting(registration?.waiting ?? undefined);
    };
    const found = () => {
      installing?.removeEventListener("statechange", changed);
      installing = registration?.installing;
      installing?.addEventListener("statechange", changed);
      changed();
    };
    void navigator.serviceWorker
      .getRegistration()
      .then((value) => {
        if (stopped) return;
        registration = value;
        registration?.addEventListener("updatefound", found);
        found();
      })
      .catch(() => {});
    return () => {
      stopped = true;
      registration?.removeEventListener("updatefound", found);
      installing?.removeEventListener("statechange", changed);
    };
  }, []);
  if (!waiting) return null;
  async function update() {
    setBusy(true);
    setMessage("");
    try {
      if (waiting) await activateAppUpdate(waiting);
    } catch (failure) {
      setMessage(
        failure instanceof Error
          ? failure.message
          : "Finish pending work before updating.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 border-t pt-3">
      <Button variant="outline" disabled={busy} onClick={update}>
        <RefreshCw aria-hidden="true" />
        {busy ? "Updating…" : "Update app"}
      </Button>
      <p className="text-xs text-muted-foreground">
        A new version is available. Finish saved work before updating.
      </p>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
