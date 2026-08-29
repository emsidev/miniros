import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import {
  DataCard,
  MetricCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { listProductionOverview } from "@/server/services/production-overview";

export const dynamic = "force-dynamic";

function dateQueryValue(value: string | string[] | undefined) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : undefined;
}

export default async function AdminProductionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    from: dateQueryValue(params.from),
    to: dateQueryValue(params.to),
  };
  const overview = await listProductionOverview(filters);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production overview"
        description="See what your team produced across shifts and where it was logged."
      />
      <form className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="production-from">From</Label>
          <Input
            id="production-from"
            name="from"
            type="date"
            defaultValue={filters.from}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="production-to">To</Label>
          <Input
            id="production-to"
            name="to"
            type="date"
            defaultValue={filters.to}
          />
        </div>
        <Button type="submit" className="h-10 rounded-xl">
          Apply dates
        </Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Production logs"
          value={overview.rows.length}
          hint="Latest 100 matching records"
        />
        <MetricCard
          label="Products made"
          value={overview.totals.length}
          hint="Distinct product and unit combinations"
          emphasis
        />
      </div>
      <section>
        <SectionHeader title="Totals by product" />
        {overview.totals.length === 0 ? (
          <EmptyState
            title="No production logged"
            description="Production entries from an active shift will appear here."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.totals.map((total) => (
              <DataCard key={`${total.productName}-${total.unit}`}>
                <p className="font-bold">{total.productName}</p>
                <p className="mt-2 text-2xl font-extrabold">
                  {formatQuantity(total.quantityProduced)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {total.unit} produced
                </p>
              </DataCard>
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionHeader title="Recent production logs" />
        {overview.rows.length === 0 ? null : (
          <div className="space-y-2">
            {overview.rows.map((row) => (
              <DataCard
                key={row.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-bold">{row.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.locationName} · {row.shiftDate}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold">
                    {formatQuantity(row.quantityProduced)} {row.unit}
                  </span>
                  <StatusBadge status="logged" />
                  <time className="text-xs text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </time>
                </div>
              </DataCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
