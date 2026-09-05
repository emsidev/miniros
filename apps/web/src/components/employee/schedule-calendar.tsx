"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/feedback";
import { cn } from "@/lib/utils";
import {
  calendarDate,
  dateKey,
  isAssigned,
  monthDays,
  moveMonth,
  type ScheduleShift,
} from "@/lib/schedule";
import { joinShiftAction } from "@/server/actions/operations";
import { shiftAction } from "./shift-presentation";

const fullDate = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(calendarDate(date));
const monthLabel = (date: string) =>
  new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(calendarDate(date));

export function ScheduleCalendar({
  shifts,
  today,
  canUsePos,
}: {
  shifts: ScheduleShift[];
  today: string;
  canUsePos: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [joining, setJoining] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [message, setMessage] = useState("");
  const [joined, setJoined] = useState<Record<string, string>>({});
  useEffect(() => setJoined({}), [shifts]);
  const submitting = useRef(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const displayed = shifts.map((shift) => {
    if (joined[shift.id] && !shift.assigned)
      return {
        ...shift,
        assigned: true,
        assignmentStatus: "assigned" as const,
        canJoin: false,
        conflict: false,
        reason: null,
      };
    if (!shift.assigned && Object.values(joined).includes(shift.shiftDate))
      return {
        ...shift,
        conflict: true,
        canJoin: false,
        reason: "You already have an assignment on this date.",
      };
    return shift;
  });
  const byDate = new Map<string, ScheduleShift[]>();
  for (const shift of displayed)
    byDate.set(shift.shiftDate, [
      ...(byDate.get(shift.shiftDate) ?? []),
      shift,
    ]);
  const agenda = byDate.get(selected) ?? [];
  const days = monthDays(`${month}-01`);
  function choose(date: string, focus = false) {
    setSelected(date);
    setMonth(date.slice(0, 7));
    if (focus) requestAnimationFrame(() => buttons.current.get(date)?.focus());
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -calendarDate(date).getUTCDay(),
      End: 6 - calendarDate(date).getUTCDay(),
    };
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      choose(moveMonth(date, event.key === "PageUp" ? -1 : 1), true);
    } else if (event.key in offsets) {
      event.preventDefault();
      choose(
        dateKey(
          new Date(
            calendarDate(date).getTime() + offsets[event.key]! * 86400000,
          ),
        ),
        true,
      );
    }
  }
  async function join(shift: ScheduleShift) {
    if (submitting.current) return;
    if (!navigator.onLine) {
      setMessage("Connect to the internet to join a shift.");
      toast.error("Connect to the internet to join a shift.");
      return;
    }
    submitting.current = true;
    setJoining(shift.id);
    setMessage(`Joining ${shift.title || shift.locationName}…`);
    try {
      const result = await joinShiftAction(shift.id);
      if (!result.ok) throw new Error(result.error);
      setJoined((current) => ({ ...current, [shift.id]: shift.shiftDate }));
      const success = `You are assigned to ${shift.title || shift.locationName}.`;
      setMessage(success);
      toast.success(success);
    } catch (error) {
      const failure =
        error instanceof Error
          ? error.message
          : "Could not join this shift. Please try again.";
      setMessage(failure);
      toast.error(failure);
    } finally {
      setJoining(null);
      submitting.current = false;
      startRefresh(() => router.refresh());
    }
  }
  return (
    <div className="space-y-4">
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn("text-sm", !message && "sr-only")}
      >
        {message}
      </p>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section
          aria-label="Shift calendar"
          className="min-w-0 rounded-xl border bg-card p-3 sm:p-5"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold" aria-live="polite">
              {monthLabel(`${month}-01`)}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous month"
                onClick={() => choose(moveMonth(`${month}-01`, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="outline" onClick={() => choose(today)}>
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next month"
                onClick={() => choose(moveMonth(`${month}-01`, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          <p id="calendar-help" className="sr-only">
            Use arrow keys to move by day or week, Home and End for the week,
            and Page Up and Page Down for the month.
          </p>
          <div
            role="grid"
            aria-label={monthLabel(`${month}-01`)}
            aria-describedby="calendar-help"
          >
            <div role="row" className="grid grid-cols-7">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  role="columnheader"
                  key={day}
                  className="pb-2 text-center text-xs font-semibold text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>
            {Array.from({ length: days.length / 7 }, (_, week) => (
              <div role="row" key={week} className="grid grid-cols-7 gap-1">
                {days.slice(week * 7, week * 7 + 7).map((date) => {
                  const count = byDate.get(date)?.length ?? 0;
                  return (
                    <div
                      role="gridcell"
                      key={date}
                      aria-selected={selected === date}
                      className="min-w-0 py-0.5"
                    >
                      <button
                        type="button"
                        ref={(element) => {
                          if (element) buttons.current.set(date, element);
                          else buttons.current.delete(date);
                        }}
                        tabIndex={selected === date ? 0 : -1}
                        aria-current={date === today ? "date" : undefined}
                        aria-label={`${fullDate(date)}, ${count} ${count === 1 ? "shift" : "shifts"}${date === today ? ", today" : ""}`}
                        onClick={() => choose(date)}
                        onKeyDown={(event) => keyboard(event, date)}
                        className={cn(
                          "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-lg border border-transparent text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:min-h-20",
                          date.slice(0, 7) !== month && "text-muted-foreground",
                          date === today && "border-primary",
                          selected === date
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted",
                        )}
                      >
                        <span className="font-semibold">
                          {Number(date.slice(-2))}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] sm:text-xs",
                            !count && "invisible",
                          )}
                        >
                          {count}
                          <span className="hidden sm:inline">
                            {" "}
                            {count === 1 ? "shift" : "shifts"}
                          </span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Shift counts by date · Asia/Manila
          </p>
        </section>
        <section
          aria-labelledby="schedule-agenda"
          className="min-w-0 space-y-4"
        >
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Selected day
            </p>
            <h2 id="schedule-agenda" className="text-lg font-bold">
              <time dateTime={selected}>{fullDate(selected)}</time>
            </h2>
            <p
              className="mt-1 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {agenda.length} {agenda.length === 1 ? "shift" : "shifts"}
            </p>
          </div>
          {!agenda.length ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <CalendarDays
                className="mx-auto mb-3 size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <h3 className="font-semibold">No shifts on this date</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose another day to see published shifts.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {agenda.map((shift) => {
                const action = shiftAction(
                  { ...shift, assignmentStatus: shift.assignmentStatus ?? "" },
                  canUsePos,
                );
                return (
                  <article key={shift.id} className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={shift.status} />
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold",
                          shift.assigned
                            ? "text-success"
                            : shift.conflict
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        {shift.assigned && (
                          <Check className="size-3.5" aria-hidden="true" />
                        )}
                        {shift.assigned
                          ? "Assigned"
                          : shift.conflict
                            ? "Schedule conflict"
                            : shift.canJoin
                              ? "Available to join"
                              : "Not available to join"}
                      </span>
                    </div>
                    <h3 className="break-words font-bold">
                      {shift.title || shift.locationName}
                    </h3>
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="break-words">{shift.locationName}</span>
                    </p>
                    {shift.assigned && isAssigned(shift.assignmentStatus) ? (
                      <div className="flex flex-wrap gap-2">
                        {action.href !== `/shifts/${shift.id}` && (
                          <Button asChild variant="ghost">
                            <Link href={`/shifts/${shift.id}`}>Details</Link>
                          </Button>
                        )}
                        <Button asChild variant="outline">
                          <Link href={action.href}>
                            {action.label}
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        </Button>
                      </div>
                    ) : shift.canJoin ? (
                      <Button
                        disabled={Boolean(joining) || refreshing}
                        onClick={() => join(shift)}
                        className="w-full sm:w-auto"
                        aria-label={`Join shift: ${shift.title || shift.locationName}`}
                      >
                        {joining === shift.id && (
                          <LoaderCircle
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        )}
                        {joining === shift.id ? "Joining…" : "Join shift"}
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {shift.reason}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Join before a shift starts. One assignment per date. Internet
            connection required.
          </p>
        </section>
      </div>
    </div>
  );
}
