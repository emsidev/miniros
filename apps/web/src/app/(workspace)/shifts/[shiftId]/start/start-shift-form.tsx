"use client";
import { ShiftCountWorkflow } from "@/components/employee/shift-count-workflow";
export function StartShiftForm({
  shiftId,
  items,
}: {
  shiftId: string;
  items: readonly { id: string; name: string; unit: string }[];
}) {
  return (
    <ShiftCountWorkflow
      key={shiftId}
      mode="start"
      shiftId={shiftId}
      items={items.map((item) => ({ ...item, initialQuantity: "0" }))}
    />
  );
}
