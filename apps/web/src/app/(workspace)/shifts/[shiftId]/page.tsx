import { isAdminMemberRole } from "@miniros/domain";
import { reservedShiftDevice } from "@/server/services/offline-prepare";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Boxes, Factory, WalletCards } from "lucide-react";
import { ShiftContext } from "@/components/employee/shift-context";
import { shiftAction } from "@/components/employee/shift-presentation";
import { ProfitBadge } from "@/components/shared/feedback";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { getAssignedShift } from "@/server/services/operator";

export const dynamic = "force-dynamic";
export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { employee, business, membership } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const { shiftId } = await params;
  const shift = await getAssignedShift(shiftId);
  const reserved = await reservedShiftDevice(shiftId);
  const action = reserved
    ? {
        href: reserved.ownsDevice
          ? `/offline?session=${reserved.id}`
          : isAdminMemberRole(membership.role)
            ? `/admin/devices?session=${reserved.id}`
            : `/shifts/${shiftId}`,
        label: reserved.ownsDevice ? "Continue shift" : "Review device access",
      }
    : shiftAction(shift, shift.permissions.canUsePos);
  const canAct = ["assigned", "confirmed"].includes(shift.assignmentStatus);
  const open =
    !reserved &&
    canAct &&
    (shift.status === "active" || shift.status === "closing");
  const guidance = {
    draft:
      "This assignment is being prepared. Check back once your admin publishes the shift.",
    scheduled: shift.permissions.canUsePos
      ? "Count the stock you have before you begin selling."
      : "Your operator will start this shift. Check your assignment and notes below.",
    active: shift.permissions.canUsePos
      ? "Ready to sell. Keep stock movements and cash deductions up to date as you work."
      : "Your shift is in progress. Keep your inventory up to date as you work.",
    closing:
      "Finish your stock count and cash reconciliation, then review the closeout.",
    closed:
      "This shift is closed. Review the result and your assignment below.",
    cancelled:
      "This shift was cancelled. Check My shifts for your next assignment.",
  }[shift.status];
  return (
    <div className="space-y-6">
      <ShiftContext
        shift={shift}
        title={shift.title || shift.locationName}
        backHref="/shifts"
        backLabel="Back to shifts"
      />
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-lg font-bold">
              {shift.status === "closed"
                ? "Shift complete"
                : shift.status === "cancelled"
                  ? "Assignment cancelled"
                  : "Your next step"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {reserved
                ? reserved.ownsDevice
                  ? "This shift is saved on this device. Open it to count stock, sell, or close out."
                  : "This shift was prepared on another device. Use that device to continue, or ask your owner to review device access. Do not enter the same sales again."
                : guidance}
            </p>
          </div>
          {action.href !== `/shifts/${shift.id}` ? (
            <Button asChild size="lg" className="shrink-0">
              <Link href={action.href}>
                {action.label}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
        {open ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
            <Button asChild variant="outline">
              <Link href={`/inventory?shift=${shift.id}`}>
                <Boxes aria-hidden="true" />
                Inventory & cash
              </Link>
            </Button>
            {shift.status === "active" &&
            shift.permissions.canLogProduction &&
            business.features.productionEnabled ? (
              <Button asChild variant="outline">
                <Link href="/production">
                  <Factory aria-hidden="true" />
                  Log production
                </Link>
              </Button>
            ) : null}
            {shift.status === "active" && shift.permissions.canUsePos ? (
              <Button asChild variant="ghost">
                <Link href={`/shifts/${shift.id}/close`}>
                  <WalletCards aria-hidden="true" />
                  Close shift
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>
      {shift.permissions.canUsePos ? (
        <Button asChild variant="outline">
          <Link href={`/shifts/${shiftId}/sales`}>Sales and receipts</Link>
        </Button>
      ) : null}
      {shift.profitResult && shift.profitCents !== null ? (
        <section className="rounded-xl bg-foreground p-5 text-background sm:p-6">
          <p className="text-sm">Shift result</p>
          <p className="my-2 break-words text-3xl font-extrabold tabular-nums">
            {formatMoney(shift.profitCents)}
          </p>
          <ProfitBadge result={shift.profitResult} />
          <p className="mt-3 text-sm">
            Sales after the costs recorded for this shift.
          </p>
        </section>
      ) : null}
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Your assignment</h2>
          <dl className="rounded-xl border bg-card p-5 text-sm">
            <dt className="text-muted-foreground">Your role</dt>
            <dd className="mt-1 font-semibold capitalize">
              {shift.roleOnShift}
            </dd>
            {shift.notes ? (
              <>
                <dt className="mt-5 text-muted-foreground">Shift notes</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words">
                  {shift.notes}
                </dd>
              </>
            ) : null}
          </dl>
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold">
            Assigned team{" "}
            <span className="font-normal text-muted-foreground">
              ({shift.teammates.length})
            </span>
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {shift.teammates.map((teammate) => (
              <li
                key={teammate.employeeId}
                className="flex items-center justify-between gap-4 px-5 py-4 text-sm"
              >
                <span className="min-w-0 break-words font-semibold">
                  {teammate.name}
                </span>
                <span className="text-right capitalize text-muted-foreground">
                  {teammate.roleOnShift}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
