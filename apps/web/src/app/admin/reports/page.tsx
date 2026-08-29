import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import {
  EmptyState,
  LocationProfitBadge,
  ProfitBadge,
} from "@/components/shared/feedback";
import { DataCard, MetricCard, PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { listLocationProfitability } from "@/server/services/analytics";

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
              ? "flex-1 rounded-t bg-emerald-500"
              : "flex-1 rounded-t bg-red-400"
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
  const locations = await listLocationProfitability(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Location profitability"
        description="Did this location actually make money—and should we rent it again?"
      />

      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
