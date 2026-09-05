import { Suspense } from "react";
import { DeviceWorkspace } from "@/features/offline/device-workspace";
export const dynamic = "force-static";
export const metadata = { title: "Saved shifts" };
export default function OfflinePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Opening saved shifts…
        </p>
      }
    >
      <DeviceWorkspace />
    </Suspense>
  );
}
