import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Factory,
  Play,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import { ProfitBadge, StatusBadge } from "@/components/shared/feedback";
import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getAssignedShift } from "@/server/services/operator";

export const dynamic = "force-dynamic";

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params;
  const shift = await getAssignedShift(shiftId);
  const canUsePos = shift.permissions.canUsePos;
  const canLogProduction = shift.permissions.canLogProduction;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href="/shifts">
          <ArrowLeft aria-hidden="true" /> Back to shifts
        </Link>
      </Button>
      <PageHeader
        title={shift.title || shift.locationName}
        description={`${shift.locationName} · ${formatDate(shift.shiftDate)}`}
        action={<StatusBadge status={shift.status} />}
      />

      <DataCard>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Scheduled start</dt>
            <dd className="mt-1 font-semibold">
              {shift.scheduledStartAt
                ? formatDateTime(shift.scheduledStartAt)
                : "To be announced"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Your role</dt>
            <dd className="mt-1 font-semibold capitalize">
              {shift.roleOnShift}
            </dd>
          </div>
          {shift.notes ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="mt-1">{shift.notes}</dd>
            </div>
          ) : null}
        </dl>
      </DataCard>

      {shift.profitResult && shift.profitCents !== null ? (
        <DataCard>
          <SectionHeader
            title="Shift result"
            description="Sales after the costs recorded for this shift."
            action={
              <ProfitBadge
                result={shift.profitResult}
                amount={formatMoney(shift.profitCents)}
              />
            }
          />
        </DataCard>
      ) : null}

      <section>
        <SectionHeader title="Shift actions" />
        <div className="grid gap-3 sm:grid-cols-2">
          {shift.status === "scheduled" && canUsePos ? (
            <Button asChild size="lg" className="h-12 rounded-xl">
              <Link href={`/shifts/${shift.id}/start`}>
                <Play aria-hidden="true" /> Start shift
              </Link>
            </Button>
          ) : null}
          {shift.status === "active" && canUsePos ? (
            <Button asChild size="lg" className="h-12 rounded-xl">
              <Link href={`/pos?shift=${shift.id}`}>
                <ShoppingCart aria-hidden="true" /> Open POS
              </Link>
            </Button>
          ) : null}
          {shift.status === "active" && canLogProduction ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-xl"
            >
              <Link href={`/production?shift=${shift.id}`}>
                <Factory aria-hidden="true" /> Log production
              </Link>
            </Button>
          ) : null}
          {shift.status === "active" || shift.status === "closing" ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-xl"
            >
              <Link href={`/inventory?shift=${shift.id}`}>
                <Boxes aria-hidden="true" /> View inventory
              </Link>
            </Button>
          ) : null}
          {(shift.status === "active" || shift.status === "closing") &&
          canUsePos ? (
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 rounded-xl"
            >
              <Link href={`/shifts/${shift.id}/close`}>
                <WalletCards aria-hidden="true" /> Close shift
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeader title="Assigned team" />
        <div className="grid gap-2 sm:grid-cols-2">
          {shift.teammates.map((teammate) => (
            <DataCard key={teammate.employeeId}>
              <p className="font-semibold">{teammate.name}</p>
              <p className="text-sm capitalize text-muted-foreground">
                {teammate.roleOnShift}
              </p>
            </DataCard>
          ))}
        </div>
      </section>
    </div>
  );
}
