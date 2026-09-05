import { notFound } from "next/navigation";
import Link from "next/link";
import { PlanningForm } from "@/components/admin/shifts/planning-form";
import { getAdminShift } from "@/server/services/admin-shifts";
import { getShiftSetupOptions } from "@/server/services/shift-setup-options";
import { editableShift } from "@/lib/shift-planning";
import { ShiftPlanningError } from "@/server/services/shift-planning-error";
export const dynamic = "force-dynamic";
export default async function EditShiftPage({
  params,
  searchParams,
}: {
  params: Promise<{ shiftId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ shiftId }, query] = await Promise.all([params, searchParams]);
  let shift;
  try {
    shift = await getAdminShift(shiftId);
  } catch (error) {
    if (error instanceof ShiftPlanningError) notFound();
    throw error;
  }
  if (!editableShift(shift.status))
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">
          This shift can no longer be edited
        </h1>
        <p className="text-muted-foreground">
          Only draft and scheduled shifts can be changed.
        </p>
        <Link className="underline" href={`/admin/shifts/${shift.id}`}>
          View shift
        </Link>
      </div>
    );
  const options = await getShiftSetupOptions(shift);
  return (
    <PlanningForm
      {...options}
      shift={shift}
      initialDate={shift.shiftDate}
      returnTo={query.returnTo}
    />
  );
}
