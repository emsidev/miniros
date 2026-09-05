import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/layout";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { listScheduleShifts } from "@/server/services/schedule";
import { manilaToday } from "@/lib/shift-planning";
import { ScheduleCalendar } from "@/components/employee/schedule-calendar";

export const dynamic = "force-dynamic";
export default async function SchedulePage() {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const shifts = await listScheduleShifts();
  return (
    <div className="space-y-6">
      <Link
        href="/shifts"
        className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to My shifts
      </Link>
      <PageHeader
        title="Schedule"
        description="All published shifts. Choose a date to view your assignments or join an available shift."
      />
      <ScheduleCalendar
        shifts={shifts}
        today={manilaToday()}
        canUsePos={employee?.canUsePos ?? false}
      />
    </div>
  );
}
