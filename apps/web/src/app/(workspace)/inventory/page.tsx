import { redirect } from "next/navigation";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { getInventoryWorkspace } from "@/server/services/inventory-workspace";
import { historyPage } from "@/lib/inventory-workspace";
import { PreparedEntry } from "@/features/offline/prepared-entry";
import { isLegacyOnlineShift } from "@/server/services/legacy-online-shift";
import { InventoryWorkspace } from "./workspace";

export const dynamic = "force-dynamic";
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string; page?: string; tab?: string }>;
}) {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const params = await searchParams;
  if (!params.shift) redirect("/shifts");
  if (!(await isLegacyOnlineShift(params.shift)))
    return <PreparedEntry shiftId={params.shift} task="inventory" />;
  const workspace = await getInventoryWorkspace(
    params.shift,
    historyPage(params.page),
  );
  return <InventoryWorkspace workspace={workspace} tab={params.tab} />;
}
