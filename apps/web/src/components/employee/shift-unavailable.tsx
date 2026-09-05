import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OperationalShiftUnavailableReason } from "@/server/services/operator-workspace-errors";
export function ShiftUnavailable({
  reason,
}: {
  reason: OperationalShiftUnavailableReason;
}) {
  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-xl border border-dashed bg-card px-5 py-10 text-center">
      <CalendarDays
        className="mx-auto size-8 text-muted-foreground"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-extrabold">
        {reason === "requested_shift_unavailable"
          ? "Shift unavailable"
          : "No active shift"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {reason === "requested_shift_unavailable"
          ? "This shift is no longer open or available to you. Choose an assignment from My shifts to continue."
          : "Start an assigned shift to begin selling and track inventory. Your assignments are in My shifts."}
      </p>
      <Button asChild>
        <Link href="/shifts">View my shifts</Link>
      </Button>
    </section>
  );
}
