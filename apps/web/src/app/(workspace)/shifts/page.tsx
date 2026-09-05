import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/layout";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { listAssignedShifts } from "@/server/services/operator";

import { ShiftList } from "../_components/shift-list";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const shifts = await listAssignedShifts();

  return (
    <>
      <PageHeader
        title="My shifts"
        description="Your assignments, your next action, and the day’s results."
        action={
          <Button asChild variant="outline">
            <Link href="/schedule">
              <CalendarDays aria-hidden="true" />
              Schedule
            </Link>
          </Button>
        }
      />
      <ShiftList shifts={shifts} canUsePos={employee?.canUsePos ?? false} />
    </>
  );
}
