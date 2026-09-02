import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  DataCard,
  MetricCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPaymentMethod } from "@/lib/format";
import { getCloseoutWorkspace } from "@/server/services/closeout-workspace";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { CloseoutForm } from "./closeout-form";

export const dynamic = "force-dynamic";

export default async function CloseShiftPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const { shiftId } = await params;
  const workspace = await getCloseoutWorkspace(shiftId);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href={`/shifts/${shiftId}`}>
          <ArrowLeft aria-hidden="true" /> Back to shift
        </Link>
      </Button>
      <PageHeader
        title="Close shift"
        description={`${workspace.shift.locationName} · Reconcile payments, deductions, and inventory before closing.`}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Gross sales"
          value={formatMoney(workspace.saleSummary.grossSalesCents)}
        />
        <MetricCard
          label="Discounts"
          value={formatMoney(workspace.saleSummary.discountsCents)}
        />
        <MetricCard
          label="Approved deductions"
          value={formatMoney(workspace.approvedDeductionsCents)}
        />
      </div>
      <section>
        <SectionHeader title="Payment summary" />
        <div className="grid gap-3 sm:grid-cols-2">
          {workspace.paymentSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed payments.
            </p>
          ) : (
            workspace.paymentSummary.map((payment) => (
              <DataCard
                key={payment.method}
                className="flex items-center justify-between"
              >
                <span>{formatPaymentMethod(payment.method)}</span>
                <strong>{formatMoney(payment.amountCents)}</strong>
              </DataCard>
            ))
          )}
        </div>
      </section>
      <CloseoutForm shiftId={shiftId} balances={workspace.balances} />
    </div>
  );
}
