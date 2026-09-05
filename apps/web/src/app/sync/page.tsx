import { redirect } from "next/navigation";
import { legacyDeviceUrl } from "@/lib/offline/device-status";

export default async function LegacyDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { session } = await searchParams;
  redirect(
    legacyDeviceUrl("sync", typeof session === "string" ? session : undefined),
  );
}
