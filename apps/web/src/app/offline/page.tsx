import { Suspense } from "react";
import { DeviceWorkspace } from "@/features/offline/device-workspace";
export const dynamic = "force-static";
export const metadata = { title: "Employee workspace" };
export default function OfflinePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Opening your workspace…
        </p>
      }
    >
      <DeviceWorkspace />
    </Suspense>
  );
}
