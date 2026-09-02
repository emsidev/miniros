import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProfitBadge, StatusBadge } from "@/components/shared/feedback";
import {
  DataCard,
  MetricCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { getAdminShiftDetail } from "@/server/services/analytics";

export const dynamic = "force-dynamic";

export default async function AdminShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params;
  const shift = await getAdminShiftDetail(shiftId);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href="/admin/shifts">
          <ArrowLeft aria-hidden="true" /> Back to shifts
        </Link>
      </Button>
      <PageHeader
        title={shift.title || shift.locationName}
        description={`${shift.locationName} · ${formatDate(shift.shiftDate)}`}
        action={<StatusBadge status={shift.status} />}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Gross sales"
          value={formatMoney(shift.grossSalesCents ?? 0)}
        />
        <MetricCard
          label="Product costs"
          value={formatMoney(shift.productCostCents ?? 0)}
        />
        <MetricCard
          label="Total costs"
          value={formatMoney(shift.totalCostsCents ?? 0)}
        />
        <MetricCard
          label="Profit / loss"
          value={formatMoney(shift.profitCents ?? 0)}
          emphasis
        />
      </div>
      {shift.result && shift.profitCents !== null ? (
        <ProfitBadge
          result={shift.result}
          amount={formatMoney(shift.profitCents)}
        />
      ) : null}
      <section>
        <SectionHeader title="Assigned team" />
        <div className="grid gap-3 sm:grid-cols-2">
          {shift.assignments.map((assignment) => (
            <DataCard key={assignment.id}>
              <p className="font-semibold">{assignment.employeeName}</p>
              <p className="text-sm capitalize text-muted-foreground">
                {assignment.roleOnShift} ·{" "}
                {formatMoney(assignment.salaryRateCents)}
              </p>
            </DataCard>
          ))}
        </div>
      </section>
    </div>
  );
}
