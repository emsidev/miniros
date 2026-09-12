import { redirect } from "next/navigation";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { getAssignedShift } from "@/server/services/operator";
import { isLegacyOnlineShift } from "@/server/services/legacy-online-shift";
import { getPosWorkspace } from "@/server/services/operator-workspaces";
import { PosForm } from "./pos-form";
import { PreparedEntry } from "@/features/offline/prepared-entry";

export const dynamic = "force-dynamic";
export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const { shift } = await searchParams;
  if (!shift) redirect("/shifts");
  const assigned = await getAssignedShift(shift);
  if (
    !assigned ||
    !["assigned", "confirmed"].includes(assigned.assignmentStatus) ||
    !["active", "closing"].includes(assigned.status)
  )
    redirect(`/shifts/${shift}`);
  let fallback;
  if (assigned.status === "active" && (await isLegacyOnlineShift(shift))) {
    const workspace = await getPosWorkspace(shift);
    fallback = (
      <PosForm
        key={`${workspace.draftOwnerKey}:${shift}`}
        shiftId={shift}
        draftOwnerKey={workspace.draftOwnerKey}
        locationName={workspace.shift.locationName}
        shiftDate={workspace.shift.shiftDate}
        inventoryBalances={workspace.inventoryBalances}
        products={workspace.products}
        promosEnabled={workspace.promosEnabled}
        promos={workspace.promos}
      />
    );
  }
  return <PreparedEntry shiftId={shift} task="sell" fallback={fallback} />;
}
