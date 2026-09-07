"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DeviceProvider } from "./device-provider";
import { PwaProvider } from "./pwa-provider";
/** Keep the synthetic walkthrough away from retained device journals and sync. */
export function ApplicationProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (
    process.env.NODE_ENV === "development" &&
    pathname === "/dev/workflow-skeleton"
  )
    return <>{children}</>;
  return (
    <>
      <DeviceProvider>{children}</DeviceProvider>
      <PwaProvider />
    </>
  );
}
