import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";

import {
  EmptyState,
  ProfitBadge,
  StatusBadge,
} from "@/components/shared/feedback";
import { DataCard } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import type { listAssignedShifts } from "@/server/services/operator";

type AssignedShift = Awaited<ReturnType<typeof listAssignedShifts>>[number];

export function ShiftList({ shifts }: { shifts: AssignedShift[] }) {
  if (shifts.length === 0) {
    return (
      <EmptyState
        title="No assigned shifts"
        description="Your assigned selling shifts will appear here as soon as an admin schedules them."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {shifts.map((shift) => (
        <DataCard key={shift.id} className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">{shift.title || shift.locationName}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" />
                {shift.locationName}
              </p>
            </div>
            <StatusBadge status={shift.status} />
          </div>
          <div className="text-sm">
            <p className="flex items-center gap-1.5">
              <CalendarDays
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {formatDate(shift.shiftDate)}
            </p>
          </div>
          {shift.profitResult && shift.profitCents !== null ? (
            <ProfitBadge
              result={shift.profitResult}
              amount={formatMoney(shift.profitCents)}
            />
          ) : null}
          <Button asChild variant="outline" className="h-11 w-full rounded-xl">
            <Link href={`/shifts/${shift.id}`}>View shift</Link>
          </Button>
        </DataCard>
      ))}
    </div>
  );
}
