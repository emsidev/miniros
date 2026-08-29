import { PageHeader } from "@/components/shared/layout";
import { listAssignedShifts } from "@/server/services/operator";

import { ShiftList } from "../_components/shift-list";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const shifts = await listAssignedShifts();

  return (
    <>
      <PageHeader
        title="My schedule"
        description="Your booth assignments, times, and current shift status."
      />
      <ShiftList shifts={shifts} />
    </>
  );
}
