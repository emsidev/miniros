import { ShiftWorkspace } from "@/components/admin/shifts/workspace";
import { listAdminShifts } from "@/server/services/admin-shifts";
import { getShiftSetupOptions } from "@/server/services/shift-setup-options";
import { manilaToday } from "@/lib/shift-planning";
export const dynamic = "force-dynamic";
export default async function AdminShiftsPage() {
  const [shifts, options] = await Promise.all([
    listAdminShifts(),
    getShiftSetupOptions(),
  ]);
  return <ShiftWorkspace shifts={shifts} {...options} today={manilaToday()} />;
}
