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
        description="Start work, sell, count inventory, and close out from one place."
      />
      <ShiftList shifts={shifts} />
    </>
  );
}
