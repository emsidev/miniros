import { redirect } from "next/navigation";
import { ShiftContext } from "@/components/employee/shift-context";
import { ShiftUnavailable } from "@/components/employee/shift-unavailable";
import { getCloseoutWorkspace } from "@/server/services/closeout-workspace";
import { OperationalShiftUnavailableError } from "@/server/services/operator-workspace-errors";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { PreparedEntry } from "@/features/offline/prepared-entry";
import { isLegacyOnlineShift } from "@/server/services/legacy-online-shift";
import { CloseoutForm } from "./closeout-form";
export const dynamic = "force-dynamic";
export default async function CloseShiftPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const { shiftId } = await params;
  if (!(await isLegacyOnlineShift(shiftId)))
    return <PreparedEntry shiftId={shiftId} task="close" />;
  let workspace;
  try {
    workspace = await getCloseoutWorkspace(shiftId);
  } catch (error) {
    if (error instanceof OperationalShiftUnavailableError)
      return <ShiftUnavailable reason={error.reason} />;
    throw error;
  }
  return (
    <div className="space-y-6">
      <ShiftContext shift={workspace.shift} title="Close shift" />
      <CloseoutForm
        shiftId={shiftId}
        balances={workspace.balances}
        summary={{
          saleSummary: workspace.saleSummary,
          paymentSummary: workspace.paymentSummary,
          approvedDeductionsCents: workspace.approvedDeductionsCents,
          openingCashCents: workspace.shift.openingCashCents,
        }}
      />
    </div>
  );
}
