import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import {
  EmptyState,
  LocationProfitBadge,
  ProfitBadge,
} from "@/components/shared/feedback";
import {
  DataCard,
  MetricCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatPaymentMethod, formatQuantity } from "@/lib/format";
import { listLocationProfitability } from "@/server/services/analytics";
import { getSalesReport } from "@/server/services/sales-reports";

export const dynamic = "force-dynamic";

function dateQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;
}

function Trend({ profits }: { profits: readonly number[] }) {
  if (profits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No closed-shift trend yet.
      </p>
    );
  }

  const maximum = Math.max(...profits.map((profit) => Math.abs(profit)), 1);
  return (
    <div
      className="flex h-16 items-end gap-1"
      role="img"
      aria-label={`Profit trend: ${profits.map((profit) => formatMoney(profit)).join(", ")}`}
    >
      {profits.map((profit, index) => (
        <span
          key={`${index}-${profit}`}
          className={
            profit >= 0
              ? "flex-1 rounded-t bg-success"
              : "flex-1 rounded-t bg-destructive"
          }
          style={{
            height: `${Math.max(8, (Math.abs(profit) / maximum) * 100)}%`,
          }}
        />
      ))}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    from: dateQueryValue(params.from),
    to: dateQueryValue(params.to),
  };
  const [locations, salesReport] = await Promise.all([
    listLocationProfitability(filters),
    getSalesReport(filters),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Location profitability"
        description="Did this location actually make money—and should we rent it again?"
      />

      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to} />
        </div>
        <Button type="submit" className="h-10 rounded-xl">
          Apply dates
        </Button>
      </form>

      <section className="space-y-3">
        <SectionHeader
          title="Sales snapshot"
          description="Completed sales for the selected date range."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Completed sales" value={salesReport.saleCount} />
          <MetricCard
            label="Gross sales"
            value={formatMoney(salesReport.grossSalesCents)}
          />
          <MetricCard
            label="Discounts"
            value={formatMoney(salesReport.totalDiscountsCents)}
          />
          <MetricCard
            label="Net sales"
            value={formatMoney(salesReport.netSalesCents)}
            emphasis
          />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <DataCard>
            <SectionHeader title="Payment mix" />
            {salesReport.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments in this range.
              </p>
            ) : (
              <div className="space-y-3">
                {salesReport.payments.map((payment) => (
                  <div
                    key={payment.paymentMethod}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {formatPaymentMethod(payment.paymentMethod)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payment.count} payment{payment.count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <strong>{formatMoney(payment.amountCents)}</strong>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
          <DataCard>
            <SectionHeader title="Product sales" />
            {salesReport.products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products sold in this range.
              </p>
            ) : (
              <div className="space-y-3">
                {salesReport.products.slice(0, 8).map((product) => (
                  <div
                    key={product.productName}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold">{product.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatQuantity(product.quantity)} sold
                      </p>
                    </div>
                    <strong>{formatMoney(product.revenueCents)}</strong>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </div>
      </section>

      {locations.length === 0 ? (
        <EmptyState
          title="No locations to report"
          description="Add a location and close its first shift to answer whether it is worth renting again."
          action={
            <Button asChild className="mt-2 rounded-xl">
              <Link href="/admin/locations">Add location</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {locations.map((location) => (
            <DataCard key={location.locationId} className="space-y-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" aria-hidden="true" /> Location
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold">
                    {location.locationName}
                  </h2>
                </div>
                <LocationProfitBadge recommendation={location.recommendation} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Closed shifts"
                  value={location.totalShifts}
                />
                <MetricCard
                  label="Gross sales"
                  value={formatMoney(location.grossSalesCents)}
                />
                <MetricCard
                  label="Total costs"
                  value={formatMoney(location.totalCostsCents)}
                />
                <MetricCard
                  label="Net profit / loss"
                  value={formatMoney(location.netProfitCents)}
                  emphasis
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Profit/loss trend
                  </p>
                  <Trend
                    profits={location.trend.map((point) => point.profitCents)}
                  />
                  <p className="mt-2 text-xs capitalize text-muted-foreground">
                    {location.trendDirection.replaceAll("_", " ")} · Average{" "}
                    {formatMoney(location.averageProfitPerShiftCents)} per shift
                  </p>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Best shift</p>
                    {location.bestShift ? (
                      <Link
                        className="mt-1 flex items-center justify-between font-semibold hover:underline"
                        href={`/admin/shifts/${location.bestShift.shiftId}`}
                      >
                        {formatMoney(location.bestShift.profitCents)}{" "}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    ) : (
                      <p className="mt-1">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Worst shift</p>
                    {location.worstShift ? (
                      <div className="mt-1">
                        <ProfitBadge
                          result={location.worstShift.result}
                          amount={formatMoney(location.worstShift.profitCents)}
                        />
                      </div>
                    ) : (
                      <p className="mt-1">—</p>
                    )}
                  </div>
                </div>
              </div>
            </DataCard>
          ))}
        </div>
      )}
    </div>
  );
}
