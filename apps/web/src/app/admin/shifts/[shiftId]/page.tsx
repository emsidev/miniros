import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  CalendarDays,
  Clock,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfitBadge, StatusBadge } from "@/components/shared/feedback";
import { BulkShiftControls } from "@/components/admin/shifts/bulk-controls";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { editableShift, safeShiftReturn } from "@/lib/shift-planning";
import { getAdminShiftDetail } from "@/server/services/analytics";
import { getShiftSetupOptions } from "@/server/services/shift-setup-options";
import { ShiftPlanningError } from "@/server/services/shift-planning-error";
export const dynamic = "force-dynamic";

export default async function AdminShiftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ shiftId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const [{ shiftId }, query] = await Promise.all([params, searchParams]);
  let shift;
  try {
    shift = await getAdminShiftDetail(shiftId);
  } catch (error) {
    if (error instanceof ShiftPlanningError) notFound();
    throw error;
  }
  const options = await getShiftSetupOptions(shift);
  const backTo = safeShiftReturn(query.returnTo);
  const team = shift.assignments.filter(
    (item) => shift.status === "cancelled" || item.status !== "cancelled",
  );
  const removedTeam =
    shift.status === "cancelled"
      ? []
      : shift.assignments.filter((item) => item.status === "cancelled");
  const hasOperator = team.some(
    (item) =>
      item.roleOnShift === "operator" &&
      options.employees.some(
        (employee) =>
          employee.id === item.employeeId &&
          employee.available &&
          employee.canUsePos,
      ),
  );
  const locationAvailable = options.locations.some(
    (item) => item.id === shift.sellingLocationId && item.available,
  );
  const unavailableTeam = team.some(
    (item) =>
      !options.employees.some(
        (employee) => employee.id === item.employeeId && employee.available,
      ),
  );
  const canEdit = editableShift(shift.status);
  const summary = shift.profitSummary;
  const live = shift.status === "active" || shift.status === "closing";
  const final = shift.status === "closed" && summary;
  const rows = final
    ? ([
        ["Product costs", summary.productCostCents],
        ["Staff pay", summary.salaryCostCents],
        ["Rent", summary.rentalCostCents],
        ["Transport", summary.transportCostCents],
        ["Other costs", summary.otherCostsCents],
        ["Approved deductions", summary.approvedDeductionsCents],
      ] as const)
    : null;
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href={backTo}>
          <ArrowLeft aria-hidden="true" />
          Back to shifts
        </Link>
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3">
            <StatusBadge status={shift.status} />
          </div>
          <h1
            id="shift-detail-heading"
            tabIndex={-1}
            className="break-words text-3xl font-extrabold"
          >
            {shift.title || shift.locationName}
          </h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {shift.locationName}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4" aria-hidden="true" />
              {formatDate(shift.shiftDate)}
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant={shift.status === "draft" ? "outline" : "default"}
            >
              <Link
                href={`/admin/shifts/${shift.id}/edit?returnTo=${encodeURIComponent(backTo)}`}
              >
                <Pencil aria-hidden="true" />
                Edit shift
              </Link>
            </Button>
            <BulkShiftControls
              returnTo={backTo}
              selected={[shift]}
              employees={options.employees}
              single
            />
          </div>
        )}
      </div>
      {shift.status === "draft" && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-bold">Prepare this shift for the team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drafts are visible only to admins. Publish when the location, team,
            and costs are ready.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              {locationAvailable ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="size-4" aria-hidden="true" />
                  Active selling location
                </span>
              ) : (
                "Choose an active selling location"
              )}
            </li>
            <li>
              {hasOperator ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="size-4" aria-hidden="true" />
                  POS operator assigned
                </span>
              ) : (
                "Add an employee with POS access as an operator"
              )}
            </li>
            {unavailableTeam && (
              <li className="text-warning">
                Replace unavailable employees before publishing
              </li>
            )}
          </ul>
        </div>
      )}
      {shift.status === "scheduled" && (
        <p className="rounded-lg border bg-card p-4 text-sm">
          Published to the assigned team. You can edit the date, team, and
          planned costs until this shift starts.
        </p>
      )}
      {shift.status === "cancelled" && (
        <p className="rounded-lg border bg-muted p-4 text-sm">
          This shift was cancelled. Its details are kept for reference; the team
          is no longer scheduled to work it.
        </p>
      )}
      {live && (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm text-muted-foreground">Sales so far</h2>
            <p className="mt-2 text-3xl font-extrabold tabular-nums">
              {formatMoney(shift.liveSalesCents)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {shift.completedSaleCount} completed{" "}
              {shift.completedSaleCount === 1 ? "sale" : "sales"}
            </p>
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="text-sm text-muted-foreground">Shift progress</h2>
            <p className="mt-2 flex items-start gap-2 font-semibold">
              <Clock className="mt-1 size-4 shrink-0" aria-hidden="true" />
              {shift.actualStartAt
                ? `Started ${formatDateTime(shift.actualStartAt)}`
                : "Start time unavailable"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {shift.status === "closing"
                ? "The team is completing closeout."
                : "The team is selling. Sales update as transactions are completed."}
            </p>
          </section>
        </div>
      )}
      {final ? (
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm text-muted-foreground">
                Final profit / loss
              </h2>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">
                {formatMoney(summary.profitCents)}
              </p>
            </div>
            <ProfitBadge result={summary.result} />
          </div>
          <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">
                Sales after discounts
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {formatMoney(summary.netSalesCents)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Total actual costs
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {formatMoney(summary.totalCostsCents)}
              </p>
            </div>
          </div>
          {shift.actualEndAt && (
            <p className="mt-4 text-sm text-muted-foreground">
              Closed {formatDateTime(shift.actualEndAt)}
            </p>
          )}
        </section>
      ) : (
        shift.status !== "cancelled" && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            Profit / loss:{" "}
            {shift.status === "closed"
              ? "The closeout profit summary is unavailable."
              : "Available after closeout."}
          </p>
        )
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-bold">
            {shift.status === "cancelled"
              ? "Previously assigned"
              : "Assigned team"}
          </h2>
          {team.length ? (
            <ul className="divide-y">
              {team.map((member) => (
                <li
                  key={member.id}
                  className="flex items-start justify-between gap-3 py-3 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold">
                      {member.employeeName}
                    </p>
                    <p className="text-sm capitalize text-muted-foreground">
                      {member.roleOnShift === "operator"
                        ? "POS operator"
                        : member.roleOnShift}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">
                      {formatMoney(member.salaryRateCents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pay for this shift
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No staff assigned yet.
            </p>
          )}
          {removedTeam.length > 0 && (
            <details className="mt-4 border-t pt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                Previously assigned ({removedTeam.length})
              </summary>
              <ul className="mt-2 space-y-2">
                {removedTeam.map((member) => (
                  <li key={member.id}>{member.employeeName} · Removed</li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-lg font-bold">
            {final ? "Final cost breakdown" : "Planned operating costs"}
          </h2>
          <dl className="space-y-3 text-sm">
            {rows ? (
              rows.map(([name, amount]) => (
                <div className="flex justify-between gap-3" key={name}>
                  <dt>{name}</dt>
                  <dd className="shrink-0 font-semibold tabular-nums">
                    {formatMoney(amount)}
                  </dd>
                </div>
              ))
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <dt>Staff pay</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(shift.salaryCostCents)}
                  </dd>
                </div>
                {shift.costs.map((cost) => (
                  <div
                    className="flex items-start justify-between gap-3"
                    key={cost.id}
                  >
                    <dt className="break-words">
                      {cost.label}
                      {cost.notes && (
                        <span className="mt-1 block text-muted-foreground">
                          {cost.notes}
                        </span>
                      )}
                    </dt>
                    <dd className="shrink-0 font-semibold tabular-nums">
                      {formatMoney(cost.amountCents)}
                    </dd>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between gap-3 border-t pt-4 font-bold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {formatMoney(
                  final
                    ? summary.totalCostsCents
                    : shift.totalExpectedCostCents,
                )}
              </dd>
            </div>
          </dl>
          {!final && (
            <p className="mt-4 text-xs text-muted-foreground">
              Excludes product costs and actual deductions recorded during the
              shift.{" "}
              {shift.status === "cancelled" &&
                "Cancelled staff assignments are excluded from the total."}
            </p>
          )}
        </section>
      </div>
      {shift.status === "closed" && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">Closeout</h2>
          {shift.cashReconciliation ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                ["Expected cash", shift.cashReconciliation.expectedCashCents],
                ["Counted cash", shift.cashReconciliation.actualCashCents],
                [
                  "Cash difference",
                  shift.cashReconciliation.cashDifferenceCents,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-lg font-bold tabular-nums">
                    {formatMoney(value as number)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Cash reconciliation is unavailable.
            </p>
          )}
          <p className="mt-5 whitespace-pre-wrap break-words text-sm">
            {shift.closeout?.notes || "No closeout notes were added."}
          </p>
          {shift.cashReconciliation?.notes && (
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              Cash notes: {shift.cashReconciliation.notes}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
