"use client";
import {
  ShiftCountWorkflow,
  type CloseoutSummary,
} from "@/components/employee/shift-count-workflow";
export function CloseoutForm({
  shiftId,
  balances,
  summary,
}: {
  shiftId: string;
  balances: readonly {
    inventoryItemId: string;
    name: string;
    unit: string;
    quantityOnHand: string;
  }[];
  summary: CloseoutSummary;
}) {
  return (
    <ShiftCountWorkflow
      key={shiftId}
      mode="close"
      shiftId={shiftId}
      items={balances.map((balance) => ({
        id: balance.inventoryItemId,
        name: balance.name,
        unit: balance.unit,
        initialQuantity: balance.quantityOnHand,
      }))}
      summary={summary}
    />
  );
}
