"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { addDays } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/feedback";
import { formatDate, formatMoney } from "@/lib/format";
import {
  fromDateKey,
  toDateKey,
} from "@/app/admin/_components/shift-date-utils";
import {
  filterWorkspaceShifts,
  readWorkspaceFilters,
  weekDates,
} from "@/lib/shift-workspace";
import { cn } from "@/lib/utils";
import { BulkShiftControls } from "./bulk-controls";
import type { AdminShift, ShiftSetupOptions } from "./types";

const selectClass =
  "h-11 w-full min-w-0 rounded-md border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function ShiftWorkspace({
  shifts,
  locations,
  employees,
  today,
}: { shifts: AdminShift[]; today: string } & ShiftSetupOptions) {
  const params = useSearchParams();
  const filters = readWorkspaceFilters(
    new URLSearchParams(params.toString()),
    today,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(
    Boolean(
      filters.location ||
      filters.employee ||
      filters.status ||
      filters.from ||
      filters.to,
    ),
  );
  const [search, setSearch] = useState(filters.q);
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    setSearch(filters.q);
  }, [filters.q]);
  const queryString = params.toString();
  const returnTo = `/admin/shifts${queryString ? `?${queryString}` : ""}`;
  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    Object.entries(values).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSelectedIds(new Set());
    setLimit(50);
    // All filter data is already loaded. Keep URL/back navigation in sync
    // without refetching the workspace for every calendar or filter change.
    window.history.replaceState(null, "", `/admin/shifts?${next.toString()}`);
  }
  const matching = filterWorkspaceShifts(shifts, filters);
  const week = weekDates(filters.date);
  const visible =
    filters.view === "calendar"
      ? matching.filter((shift) => week.includes(shift.shiftDate))
      : matching.slice(0, limit);
  const selected = shifts.filter((shift) => selectedIds.has(shift.id));
  const dayShifts = matching.filter(
    (shift) => shift.shiftDate === filters.date,
  );
  const active = matching.filter(
    (shift) => shift.status === "active" || shift.status === "closing",
  );
  const planning = visible.filter(
    (shift) => shift.status !== "active" && shift.status !== "closing",
  );
  const groups = Array.from(new Set(planning.map((shift) => shift.shiftDate)));
  const openCount = shifts.filter(
    (shift) => shift.status !== "closed" && shift.status !== "cancelled",
  ).length;
  const historyCount = shifts.length - openCount;
  const filtered = Boolean(
    filters.q ||
    filters.location ||
    filters.employee ||
    filters.status ||
    filters.from ||
    filters.to,
  );
  const locationChoices = Array.from(
    new Map([
      ...locations.map((item) => [item.id, item.name] as const),
      ...shifts.map(
        (item) => [item.sellingLocationId, item.locationName] as const,
      ),
    ]),
  );
  const employeeChoices = Array.from(
    new Map([
      ...employees.map((item) => [item.id, item.displayName] as const),
      ...shifts.flatMap((shift) =>
        shift.assignments.map(
          (item) => [item.employeeId, item.employeeName] as const,
        ),
      ),
    ]),
  );
  function newHref(date?: string) {
    const query = new URLSearchParams({ returnTo });
    if (date) query.set("date", date);
    if (filters.location) query.set("locationId", filters.location);
    return `/admin/shifts/new?${query}`;
  }
  function toggle(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function attention(shift: AdminShift) {
    if (shift.status === "scheduled" && shift.shiftDate < today)
      return "Scheduled date has passed · review this shift";
    if (
      shift.status === "draft" &&
      !shift.assignments.some(
        (item) =>
          item.status !== "cancelled" &&
          item.roleOnShift === "operator" &&
          employees.some(
            (employee) =>
              employee.id === item.employeeId &&
              employee.available &&
              employee.canUsePos,
          ),
      )
    )
      return "Needs a POS operator before publishing";
    return null;
  }
  function entry(shift: AdminShift, compact = false) {
    const team = shift.assignments.filter(
      (item) => shift.status === "cancelled" || item.status !== "cancelled",
    );
    const message = attention(shift);
    const href = `/admin/shifts/${shift.id}?returnTo=${encodeURIComponent(returnTo)}`;
    return (
      <div
        key={shift.id}
        className={cn(
          "group flex gap-3 border-b p-4 last:border-b-0 hover:bg-muted/25",
          selectedIds.has(shift.id) && "bg-muted/40",
          compact && "px-3",
        )}
      >
        <label className="flex min-h-11 w-6 shrink-0 items-start justify-center pt-1">
          <Checkbox
            checked={selectedIds.has(shift.id)}
            onCheckedChange={(value) => toggle(shift.id, value === true)}
            aria-label={`Select ${shift.title || shift.locationName}, ${formatDate(shift.shiftDate)}`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "flex flex-wrap items-start justify-between gap-2",
              compact && "flex-col",
            )}
          >
            <Link
              href={href}
              className="min-w-0 break-words font-semibold underline-offset-4 hover:underline focus-visible:underline"
            >
              {shift.title || shift.locationName}
            </Link>
            <StatusBadge status={shift.status} />
          </div>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {shift.locationName}
            {shift.status === "active" || shift.status === "closing"
              ? ` · ${formatDate(shift.shiftDate)}`
              : ""}
          </p>
          <p className="mt-2 break-words text-sm">
            {team.length
              ? team.map((item) => item.employeeName).join(", ")
              : "No staff assigned"}
          </p>
          {message && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-warning">
              <AlertCircle
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {message}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              Planned operating cost{" "}
              <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                {formatMoney(shift.totalExpectedCostCents)}
              </strong>
            </span>
            <Link
              href={href}
              className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline"
            >
              View shift
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            id="shift-workspace-heading"
            tabIndex={-1}
            className="text-3xl font-extrabold"
          >
            Shifts
          </h1>
          <p className="mt-2 text-muted-foreground">
            Plan the dates, prepare the team, and follow each shift through
            closeout.
          </p>
        </div>
        <Button asChild className="h-11">
          <Link href={newHref()}>
            <Plus aria-hidden="true" />
            Plan shifts
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b">
        <div className="flex gap-4" aria-label="Shift lifecycle">
          {(["open", "history"] as const).map((scope) => (
            <button
              type="button"
              key={scope}
              aria-pressed={filters.scope === scope}
              className={cn(
                "min-h-12 border-b-2 px-1 text-sm",
                filters.scope === scope
                  ? "border-foreground font-semibold"
                  : "border-transparent text-muted-foreground",
              )}
              onClick={() => update({ scope, status: "" })}
            >
              {scope === "open" ? "Open shifts" : "History"}
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                {scope === "open" ? openCount : historyCount}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 pb-2" aria-label="Schedule view">
          <Button
            type="button"
            variant={filters.view === "agenda" ? "secondary" : "ghost"}
            aria-pressed={filters.view === "agenda"}
            onClick={() => update({ view: "agenda" })}
          >
            <List aria-hidden="true" />
            Agenda
          </Button>
          <Button
            type="button"
            variant={filters.view === "calendar" ? "secondary" : "ghost"}
            aria-pressed={filters.view === "calendar"}
            onClick={() => update({ view: "calendar" })}
          >
            <CalendarDays aria-hidden="true" />
            Calendar
          </Button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <form
            className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto sm:max-w-xl"
            onSubmit={(event) => {
              event.preventDefault();
              update({ q: search });
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search shifts, locations, or employees"
                placeholder="Search shifts, locations, or people"
                className="h-11 pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Button type="submit" variant="outline" className="h-11">
              Search
            </Button>
          </form>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal aria-hidden="true" />
            Filters
            {filtered && <span className="size-2 rounded-full bg-foreground" />}
          </Button>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              onClick={() => {
                setSearch("");
                update({
                  q: "",
                  location: "",
                  employee: "",
                  status: "",
                  from: "",
                  to: "",
                });
              }}
            >
              <X aria-hidden="true" />
              Clear filters
            </Button>
          )}
        </div>
        {showFilters && (
          <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="filter-location">Location</Label>
              <select
                id="filter-location"
                className={selectClass}
                value={filters.location}
                onChange={(event) => update({ location: event.target.value })}
              >
                <option value="">All locations</option>
                {locationChoices.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-employee">Employee</Label>
              <select
                id="filter-employee"
                className={selectClass}
                value={filters.employee}
                onChange={(event) => update({ employee: event.target.value })}
              >
                <option value="">All employees</option>
                {employeeChoices.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <select
                id="filter-status"
                className={selectClass}
                value={filters.status}
                onChange={(event) => update({ status: event.target.value })}
              >
                <option value="">
                  All {filters.scope === "open" ? "open" : "history"} statuses
                </option>
                {(filters.scope === "open"
                  ? ["draft", "scheduled", "active", "closing"]
                  : ["closed", "cancelled"]
                ).map((status) => (
                  <option value={status} key={status}>
                    {status[0]!.toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-from">From</Label>
              <Input
                id="filter-from"
                type="date"
                className="h-11"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => update({ from: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-to">Through</Label>
              <Input
                id="filter-to"
                type="date"
                className="h-11"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => update({ to: event.target.value })}
              />
            </div>
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div
          className="space-y-3 rounded-lg border bg-card p-4"
          role="region"
          aria-label="Selected shift actions"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold" aria-live="polite">
              {selected.length} {selected.length === 1 ? "shift" : "shifts"}{" "}
              selected
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
          <BulkShiftControls
            returnTo={returnTo}
            selected={selected}
            employees={employees}
            onComplete={() => setSelectedIds(new Set())}
          />
        </div>
      )}
      {visible.length > 0 && (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox
            aria-label={
              filters.view === "calendar"
                ? "Select all shifts in this week"
                : "Select all displayed shifts"
            }
            checked={
              visible.every((shift) => selectedIds.has(shift.id))
                ? true
                : visible.some((shift) => selectedIds.has(shift.id))
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) =>
              setSelectedIds(
                value === true
                  ? new Set(visible.map((shift) => shift.id))
                  : new Set(),
              )
            }
          />
          {filters.view === "calendar"
            ? "Select this week’s shifts"
            : "Select displayed shifts"}{" "}
          <span className="text-muted-foreground">({visible.length})</span>
        </label>
      )}
      {filters.view === "calendar" ? (
        <section className="space-y-4" aria-label="Weekly shift calendar">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">
              {formatDate(week[0]!)} – {formatDate(week[6]!)}
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous week"
                onClick={() =>
                  update({
                    date: toDateKey(addDays(fromDateKey(filters.date)!, -7)),
                  })
                }
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="outline" onClick={() => update({ date: today })}>
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next week"
                onClick={() =>
                  update({
                    date: toDateKey(addDays(fromDateKey(filters.date)!, 7)),
                  })
                }
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
          {active.some((shift) => !week.includes(shift.shiftDate)) && (
            <p className="text-sm text-muted-foreground">
              {active.filter((shift) => !week.includes(shift.shiftDate)).length}{" "}
              in-progress shifts are outside this week.{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => update({ view: "agenda" })}
              >
                View in agenda
              </button>
            </p>
          )}
          <div className="lg:hidden">
            <Label htmlFor="calendar-day">Choose a day</Label>
            <select
              id="calendar-day"
              className={`${selectClass} mt-2`}
              value={filters.date}
              onChange={(event) => update({ date: event.target.value })}
            >
              {week.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)} ·{" "}
                  {matching.filter((shift) => shift.shiftDate === date).length}{" "}
                  shifts
                </option>
              ))}
            </select>
            <div className="mt-4 rounded-lg border bg-card">
              {dayShifts.length ? (
                dayShifts.map((shift) => entry(shift))
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  No matching shifts on this date.
                </p>
              )}
              <Button asChild variant="ghost" className="m-2">
                <Link href={newHref(filters.date)}>
                  <Plus aria-hidden="true" />
                  Add shift
                </Link>
              </Button>
            </div>
          </div>
          <div
            tabIndex={0}
            role="region"
            aria-label="Week grid, scroll horizontally for more days"
            className="hidden overflow-x-auto rounded-xl border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:block"
          >
            <div className="grid min-w-[1120px] grid-cols-7 divide-x">
              {week.map((date) => (
                <section key={date} className="min-w-0">
                  <div
                    className={cn("border-b p-3", date === today && "bg-muted")}
                  >
                    <h3 className="text-sm font-semibold">
                      {new Intl.DateTimeFormat("en-PH", {
                        weekday: "short",
                      }).format(fromDateKey(date))}{" "}
                      <span className="tabular-nums">
                        {fromDateKey(date)!.getDate()}
                      </span>
                      {date === today && (
                        <span className="ml-1 text-xs">Today</span>
                      )}
                    </h3>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full"
                    >
                      <Link
                        href={newHref(date)}
                        aria-label={`Add shift on ${formatDate(date)}`}
                      >
                        <Plus aria-hidden="true" />
                        Add
                      </Link>
                    </Button>
                  </div>
                  {matching
                    .filter((shift) => shift.shiftDate === date)
                    .map((shift) => entry(shift, true))}
                  {!matching.some((shift) => shift.shiftDate === date) && (
                    <p className="p-4 text-xs text-muted-foreground">
                      No shifts
                    </p>
                  )}
                </section>
              ))}
            </div>
          </div>
        </section>
      ) : matching.length ? (
        <div className="space-y-6">
          {filters.scope === "open" && active.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold">
                In progress{" "}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {active.length}
                </span>
              </h2>
              <div className="rounded-xl border bg-card">
                {visible
                  .filter(
                    (shift) =>
                      shift.status === "active" || shift.status === "closing",
                  )
                  .map((shift) => entry(shift))}
              </div>
            </section>
          )}
          {groups.map((date) => (
            <section key={date}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-bold">
                  {date === today
                    ? `Today · ${formatDate(date)}`
                    : formatDate(date)}
                </h2>
                {filters.scope === "open" && (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={newHref(date)}>
                      <Plus aria-hidden="true" />
                      Add shift
                    </Link>
                  </Button>
                )}
              </div>
              <div className="rounded-xl border bg-card">
                {planning
                  .filter((shift) => shift.shiftDate === date)
                  .map((shift) => entry(shift))}
              </div>
            </section>
          ))}
          {matching.length > limit && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLimit(limit + 50)}
            >
              Show more shifts ({matching.length - limit} remaining)
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center">
          <h2 className="text-lg font-bold">
            {filtered
              ? "No shifts match these filters"
              : filters.scope === "history"
                ? "No completed or cancelled shifts yet"
                : "No shifts planned yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {filtered
              ? "Clear or adjust the filters to see more shifts."
              : filters.scope === "history"
                ? "Closed and cancelled shifts will appear here with their records."
                : "Start with a location and a date. Save a draft now and assign the team later."}
          </p>
          {filters.scope === "open" && !filtered && (
            <Button asChild className="mt-5">
              <Link href={newHref()}>
                <Plus aria-hidden="true" />
                Plan your first shift
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
