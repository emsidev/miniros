import { PlanningForm } from "@/components/admin/shifts/planning-form";
import { getShiftSetupOptions } from "@/server/services/shift-setup-options";
import { isValidShiftDate, manilaToday } from "@/lib/shift-planning";
export const dynamic = "force-dynamic";
export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    locationId?: string;
    returnTo?: string;
  }>;
}) {
  const [options, query] = await Promise.all([
    getShiftSetupOptions(),
    searchParams,
  ]);
  return (
    <PlanningForm
      {...options}
      initialDate={
        query.date && isValidShiftDate(query.date) ? query.date : manilaToday()
      }
      initialLocationId={query.locationId}
      returnTo={query.returnTo}
    />
  );
}
