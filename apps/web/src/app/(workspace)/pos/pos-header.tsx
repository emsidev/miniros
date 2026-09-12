import { ShiftContext } from "@/components/employee/shift-context";

export function PosHeader({
  shiftId,
  locationName,
  shiftDate,
  onBack,
}: {
  shiftId: string;
  locationName: string;
  shiftDate?: string;
  onBack?: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
      <ShiftContext
        shift={{
          id: shiftId,
          locationName,
          shiftDate,
          status: "active",
        }}
        title="Sell"
        onBack={onBack}
        compact
      />
    </div>
  );
}
