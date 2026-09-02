import Link from "next/link";
import { CalendarDays, MapPin, UsersRound } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { listAdminShifts } from "@/server/services/admin-shifts";
import { listEmployees } from "@/server/services/employees";
import { listLocations } from "@/server/services/locations";
import { CreateShiftDialog } from "../_components/create-shift-dialog";
import { humanize } from "../_components/form-utils";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function formatShiftDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

function visibleAssignments<T extends { status: string }>(shift: {
  status: string;
  assignments: T[];
}): T[] {
  return shift.status === "cancelled"
    ? shift.assignments
    : shift.assignments.filter(
        (assignment) => assignment.status !== "cancelled",
      );
}

export default async function AdminShiftsPage() {
  const [shifts, locations, employees] = await Promise.all([
    listAdminShifts(),
    listLocations(),
    listEmployees(),
  ]);
  const activeLocations = locations.filter(
    (location) => location.status === "active",
  );
  const activeEmployees = employees.filter(
    (employee) => employee.status === "active",
  );
  const hasOperator = activeEmployees.some((employee) => employee.canUsePos);
  const canCreateShift =
    activeLocations.length > 0 && activeEmployees.length > 0 && hasOperator;
  const locationOptions = activeLocations.map(({ id, name }) => ({ id, name }));
  const employeeOptions = activeEmployees.map(
    ({ id, displayName, defaultShiftRateCents, canUsePos }) => ({
      id,
      displayName,
      defaultShiftRateCents,
      canUsePos,
    }),
  );
  const createAction = canCreateShift ? (
    <CreateShiftDialog
      locations={locationOptions}
      employees={employeeOptions}
    />
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Shifts"
        description="Choose the location, dates, and team for each selling shift."
        action={shifts.length > 0 ? createAction : undefined}
      />

      {shifts.length === 0 ? (
        activeLocations.length === 0 ? (
          <EmptyState
            title="Add a selling location first"
            description="Every shift needs a venue and its expected location costs."
            action={
              <Button asChild className="mt-2 h-11 rounded-xl">
                <Link href="/admin/locations">Go to locations</Link>
              </Button>
            }
          />
        ) : activeEmployees.length === 0 ? (
          <EmptyState
            title="Add an employee first"
            description="Every shift needs at least one assigned employee."
            action={
              <Button asChild className="mt-2 h-11 rounded-xl">
                <Link href="/admin/employees">Go to employees</Link>
              </Button>
            }
          />
        ) : !hasOperator ? (
          <EmptyState
            title="Enable a POS operator"
            description="At least one assigned employee must have POS access and the operator role."
            action={
              <Button asChild className="mt-2 h-11 rounded-xl">
                <Link href="/admin/employees">Review employees</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No shifts scheduled"
            description="Create the first selling shift with its location, team, and expected costs."
            action={createAction}
          />
        )
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shifts.map((shift) => {
            const assignments = visibleAssignments(shift);
            return (
              <Card key={shift.id} className="rounded-xl py-5 shadow-none">
                <CardHeader className="flex-row items-start gap-3 px-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                    <CalendarDays className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate font-bold">
                      {shift.title ?? shift.locationName}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatShiftDate(shift.shiftDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <StatusBadge status={shift.status} />
                    {shift.status === "scheduled" ? (
                      <CreateShiftDialog
                        locations={locationOptions}
                        employees={employeeOptions}
                        shift={shift}
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-5">
                  <div className="text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <MapPin className="size-4" aria-hidden="true" />
                      <span className="truncate">{shift.locationName}</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <UsersRound className="size-3.5" aria-hidden="true" />
                        Assigned team
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {assignments.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="min-w-0 truncate">
                            {assignment.employeeName}
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant="outline">
                              {humanize(assignment.roleOnShift)}
                            </Badge>
                            <span className="font-semibold">
                              {formatMoney(assignment.salaryRateCents)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Rent {formatMoney(shift.rentalCostCents)}
                    </Badge>
                    <Badge variant="outline">
                      Transport {formatMoney(shift.transportCostCents)}
                    </Badge>
                    {shift.otherCostCents > 0 ? (
                      <Badge variant="outline">
                        Other {formatMoney(shift.otherCostCents)}
                      </Badge>
                    ) : null}
                    <Badge className="ml-auto">
                      Expected {formatMoney(shift.totalExpectedCostCents)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
