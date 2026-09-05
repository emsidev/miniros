"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { liveQuery } from "dexie";
import {
  readDeviceSnapshot,
  type DeviceSnapshot,
} from "@/lib/offline/device-status";
import { refreshOfflineIdentity } from "@/lib/offline/sync";
import { offlineChanged, shiftStore } from "@/lib/offline/store";
import { DeviceContext, type DevicePanel } from "./device-context";
import { DevicePanels } from "./device-panels";

const empty: DeviceSnapshot = { shifts: [], locked: false };

export function DeviceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState(empty);
  const [verifiedPath, setVerifiedPath] = useState<string>();
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<DevicePanel>();
  const trigger = useRef<HTMLElement | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let stopped = false;
    let checked = false;
    let connectionFailedAt = 0;
    const refresh = async () => {
      checked = false;
      if (!stopped) setError("");
      try {
        // Never reveal a cached account online before checking the current session.
        if (navigator.onLine && (await shiftStore().sessions.count())) {
          try {
            await refreshOfflineIdentity();
          } catch (failure) {
            if ((failure as { code?: string }).code === "AUTH") {
              await shiftStore().meta.delete("identity");
            } else if (!stopped) {
              connectionFailedAt = Date.now();
              setError(
                "Can't reach MINIROS. Your saved work is still on this device.",
              );
            }
          }
        }
        const next = await readDeviceSnapshot();
        checked = true;
        if (!stopped) {
          setSnapshot(next);
          setVerifiedPath(pathname);
        }
      } catch {
        if (!stopped) {
          setSnapshot(empty);
          setError(
            "Device storage is unavailable. Reconnect and allow browser storage.",
          );
          setVerifiedPath(pathname);
        }
      }
    };
    refreshRef.current = refresh;
    void refresh();
    const sub = liveQuery(() => readDeviceSnapshot()).subscribe({
      next: (next) => {
        if (!stopped && checked) {
          setSnapshot(next);
          // Background sync can recover without a browser online event.
          if (
            connectionFailedAt &&
            next.shifts.some(
              ({ session }) =>
                session.lastServerContactAt &&
                Date.parse(session.lastServerContactAt) > connectionFailedAt,
            )
          ) {
            connectionFailedAt = 0;
            setError("");
          }
        }
      },
      error: () => {
        if (!stopped) {
          setSnapshot(empty);
          setError(
            "Device storage is unavailable. Reconnect and allow browser storage.",
          );
          setVerifiedPath(pathname);
        }
      },
    });
    const connection = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void refresh();
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      stopped = true;
      sub.unsubscribe();
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requested =
      params.get("panel") ??
      (location.pathname === "/install"
        ? "install"
        : location.pathname === "/sync"
          ? "sync"
          : undefined);
    setPanel(
      requested === "install" || requested === "sync" ? requested : undefined,
    );
  }, [pathname]);

  const refresh = useCallback(async () => {
    await refreshRef.current();
    offlineChanged();
  }, []);
  const openPanel = useCallback((next: DevicePanel) => {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      !active.closest('[role="dialog"]')
    )
      trigger.current = active;
    setPanel(next);
  }, []);
  const closePanel = useCallback(() => {
    setPanel(undefined);
    const url = new URL(location.href);
    if (url.searchParams.has("panel")) {
      url.searchParams.delete("panel");
      history.replaceState(history.state, "", url);
    }
  }, []);
  const loading = verifiedPath !== pathname;

  return (
    <DeviceContext.Provider
      value={{
        snapshot: loading ? empty : snapshot,
        loading,
        online,
        error: loading ? "" : error,
        refresh,
        openPanel,
        closePanel,
      }}
    >
      {children}
      <DevicePanels
        panel={panel}
        onPanelChange={setPanel}
        onClose={closePanel}
        restoreFocus={() => {
          const target = trigger.current?.isConnected
            ? trigger.current
            : document.querySelector<HTMLElement>("[data-device-menu]");
          target?.focus();
        }}
      />
    </DeviceContext.Provider>
  );
}
