"use client";

import { createContext, useContext } from "react";
import type { DeviceSnapshot } from "@/lib/offline/device-status";

export type DevicePanel = "device" | "install" | "sync";
export type DeviceContextValue = {
  snapshot: DeviceSnapshot;
  loading: boolean;
  online: boolean;
  error: string;
  refresh: () => Promise<void>;
  openPanel: (panel: DevicePanel) => void;
  closePanel: () => void;
};
export const DeviceContext = createContext<DeviceContextValue | null>(null);
export function useDevice() {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("Device controls require DeviceProvider.");
  return value;
}
