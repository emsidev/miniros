import { reservedShiftDevice } from "@/server/services/offline-prepare";
import { redirect } from "next/navigation";
import { ShiftContext } from "@/components/employee/shift-context";
import { ShiftUnavailable } from "@/components/employee/shift-unavailable";
import { getCloseoutWorkspace } from "@/server/services/closeout-workspace";
import { OperationalShiftUnavailableError } from "@/server/services/operator-workspace-errors";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
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
  const reserved = await reservedShiftDevice(shiftId);
  if (reserved?.ownsDevice) redirect(`/offline?session=${reserved.id}`);
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
        }}
      />
    </div>
  );
}
