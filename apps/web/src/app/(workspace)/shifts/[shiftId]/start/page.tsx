import { reservedShiftDevice } from "@/server/services/offline-prepare";
import { redirect } from "next/navigation";

import { ShiftContext } from "@/components/employee/shift-context";
import { getAssignedShift } from "@/server/services/operator";
import { PrepareShift } from "@/features/offline/prepare-shift";

export const dynamic = "force-dynamic";

export default async function StartShiftPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params;
  const shift = await getAssignedShift(shiftId);
  if (!shift.permissions.canUsePos) redirect(`/shifts/${shiftId}`);
  const reserved = await reservedShiftDevice(shiftId);
  if (!reserved && shift.status !== "scheduled") redirect(`/shifts/${shiftId}`);

  return (
    <div className="space-y-6">
      <ShiftContext shift={shift} title="Start shift" />
      <PrepareShift shiftId={shiftId} />
    </div>
  );
}
