"use client";
import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/offline/install-prompt";
import { synchronizePreparedShifts } from "@/lib/offline/sync";
import { visibleSessions } from "@/lib/offline/store";

export function PwaProvider() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          /* Shift preparation reports an actionable readiness error. */
        });
    } else if ("serviceWorker" in navigator) {
      // A worker installed by a previous production build survives next dev.
      // Unregister only our worker; keep saved shifts and pending work intact.
      void navigator.serviceWorker
        .getRegistrations()
        .then(async (registrations) => {
          for (const registration of registrations) {
            const worker =
              registration.active ??
              registration.waiting ??
              registration.installing;
            if (worker && new URL(worker.scriptURL).pathname === "/sw.js") {
              await registration.unregister();
            }
          }
        })
        .catch(() => {});
    }
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    let delay = 15000;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped || running) return;
      running = true;
      try {
        if (
          document.visibilityState === "visible" &&
          (await visibleSessions()).length
        ) {
          await synchronizePreparedShifts();
        }
      } finally {
        running = false;
        if (!stopped) {
          clearTimeout(timer);
          timer = setTimeout(
            () => {
              void tick().catch(() => {});
            },
            (delay = Math.min(delay * 2, 60000)),
          );
        }
      }
    };
    const resume = () => {
      clearTimeout(timer);
      delay = 15000;
      void tick().catch(() => {});
    };
    resume();
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return null;
}
