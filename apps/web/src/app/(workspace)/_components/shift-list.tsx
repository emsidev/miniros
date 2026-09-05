import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin } from "lucide-react";
import {
  EmptyState,
  ProfitBadge,
  StatusBadge,
} from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import {
  groupShifts,
  shiftAction,
} from "@/components/employee/shift-presentation";
import type { listAssignedShifts } from "@/server/services/operator";

type AssignedShift = Awaited<ReturnType<typeof listAssignedShifts>>[number];

export function ShiftRow({
  shift,
  canUsePos,
  current = false,
}: {
  shift: AssignedShift;
  canUsePos: boolean;
  current?: boolean;
}) {
  const action = shiftAction(shift, canUsePos);
  return (
    <article className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={shift.status} />
          <span className="text-sm text-muted-foreground">
            {formatDate(shift.shiftDate)}
          </span>
        </div>
        <h3
          className={
            current ? "break-words text-xl font-bold" : "break-words font-bold"
          }
        >
          <Link className="hover:underline" href={`/shifts/${shift.id}`}>
            {shift.title || shift.locationName}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="break-words">
            {shift.locationName} ·{" "}
            <span className="capitalize">{shift.roleOnShift}</span>
          </span>
        </p>
        {shift.profitResult && shift.profitCents !== null ? (
          <ProfitBadge
            result={shift.profitResult}
            amount={formatMoney(shift.profitCents)}
          />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action.href !== `/shifts/${shift.id}` ? (
          <Button asChild variant="ghost">
            <Link href={`/shifts/${shift.id}`}>Details</Link>
          </Button>
        ) : null}
        <Button
          asChild
          variant={
            current || (shift.status === "scheduled" && canUsePos)
              ? "default"
              : "outline"
          }
          className="flex-1 sm:flex-none"
        >
          <Link href={action.href}>
            {action.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function ShiftList({
  shifts,
  canUsePos = false,
}: {
  shifts: AssignedShift[];
  canUsePos?: boolean;
}) {
  if (!shifts.length)
    return (
      <EmptyState
        title="Your next shift starts here"
        description="Your assignments will appear here when an admin schedules you. Once assigned, you can review the location and prepare for your shift."
      />
    );
  const { current, upcoming, history } = groupShifts(shifts);
  return (
    <div className="space-y-8">
      <section aria-labelledby="current-shifts">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="current-shifts" className="text-lg font-bold">
            In progress
          </h2>
          <span className="text-sm text-muted-foreground">
            {current.length} shifts
          </span>
        </div>
        {current.length ? (
          <div className="divide-y rounded-xl border bg-card">
            {current.map((shift) => (
              <ShiftRow
                key={shift.id}
                shift={shift}
                canUsePos={canUsePos}
                current
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            No shift in progress. Review your next assignment below.
          </p>
        )}
      </section>
      <section aria-labelledby="upcoming-shifts">
        <h2 id="upcoming-shifts" className="mb-3 text-lg font-bold">
          Upcoming shifts
        </h2>
        {upcoming.length ? (
          <div className="divide-y rounded-xl border bg-card">
            {upcoming.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} canUsePos={canUsePos} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            You have no upcoming assignments. An admin can schedule your next
            shift.
          </p>
        )}
      </section>
      {history.length ? (
        <details className="group rounded-xl border bg-card">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold">
            Shift history{" "}
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {history.length}
            </span>
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="divide-y border-t">
            {history.map((shift) => (
              <ShiftRow key={shift.id} shift={shift} canUsePos={canUsePos} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
