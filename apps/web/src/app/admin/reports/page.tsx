import { AdminTable } from "@/components/shared/admin-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  EmptyState,
  LocationProfitBadge,
  ProfitBadge,
} from "@/components/shared/feedback";
import { PageHeader, SectionHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatPaymentMethod, formatQuantity } from "@/lib/format";
import { listLocationProfitability } from "@/server/services/analytics";
import { getShiftReportStatus } from "@/server/services/shift-report-status";
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
  const [locations, salesReport, shiftStatus] = await Promise.all([
    listLocationProfitability(filters),
    getSalesReport(filters),
    getShiftReportStatus(filters),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Sales, costs, differences, and profit by location."
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

      <section
        className="space-y-3"
        aria-label="Shift results and upload status"
      >
        <SectionHeader
          title="Shift results"
          description="Final profit uses uploaded transactions and reviewed costs. Opening float is not revenue. Unsent device data is not visible here."
        />
        <div className="divide-y border-y">
          {shiftStatus.map((shift) => (
            <details key={shift.id} className="py-2">
              <summary className="flex min-h-12 cursor-pointer flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-semibold">
                  {shift.location} · {shift.date}
                </span>
                <span className="text-sm">
                  {shift.profitCents === null
                    ? "Result incomplete"
                    : formatMoney(shift.profitCents) + " profit"}
                  {shift.pendingReviews ? " · Review required" : ""}
                  {shift.sessions.some((session) => session.status !== "closed")
                    ? " · Awaiting device upload / closeout"
                    : ""}
                </span>
              </summary>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 py-3 text-sm">
                <dt>Net sales</dt>
                <dd>
                  {shift.salesCents === null
                    ? "Not final"
                    : formatMoney(shift.salesCents)}
                </dd>
                <dt>Product costs</dt>
                <dd>
                  {shift.productCostCents === null
                    ? "Not final"
                    : formatMoney(shift.productCostCents)}
                </dd>
                <dt>Rent + transport + wages + other costs</dt>
                <dd>
                  {shift.profitCents === null
                    ? "Not final"
                    : formatMoney(
                        (shift.rentCents ?? 0) +
                          (shift.transportCents ?? 0) +
                          (shift.wagesCents ?? 0) +
                          (shift.otherCostsCents ?? 0),
                      )}
                </dd>
                <dt>Applicable expenses</dt>
                <dd>
                  {shift.expensesCents === null
                    ? "Not final"
                    : formatMoney(shift.expensesCents)}
                </dd>
                <dt>Expected / actual cash</dt>
                <dd>
                  {shift.actualCashCents === null
                    ? "Not counted"
                    : formatMoney(shift.expectedCashCents ?? 0) +
                      " / " +
                      formatMoney(shift.actualCashCents)}
                </dd>
                <dt>Cash difference</dt>
                <dd>
                  {shift.cashDifferenceCents === null
                    ? "Not counted"
                    : formatMoney(shift.cashDifferenceCents)}
                </dd>
              </dl>
              <h3 className="pt-3 text-sm font-bold">
                Stock differences · actual − expected
              </h3>
              <ul className="divide-y text-sm">
                {shift.stockDifferences.map((item, index) => (
                  <li key={index} className="flex justify-between gap-3 py-3">
                    <span>{item.name}</span>
                    <span>
                      {formatQuantity(item.difference)} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
              {!shift.stockDifferences.length ? (
                <p className="py-3 text-sm text-muted-foreground">
                  No closing stock counts uploaded.
                </p>
              ) : null}
              {shift.sessions.map((session) => (
                <p
                  key={session.sequence + session.status}
                  className="py-2 text-xs text-muted-foreground"
                >
                  Device: {session.status} · received through transaction #
                  {session.sequence}
                  {session.error ? " · " + session.error : ""}
                </p>
              ))}
              <Button asChild variant="outline" className="my-3">
                <Link href={`/admin/shifts/${shift.id}`}>View shift</Link>
              </Button>
            </details>
          ))}
        </div>
        {!shiftStatus.length ? (
          <p className="text-sm text-muted-foreground">
            No shifts in this date range.
          </p>
        ) : null}
      </section>
      <section className="space-y-3">
        <SectionHeader
          title="Sales snapshot"
          description="Completed sales for the selected date range."
        />
        <AdminTable label="Sales snapshot">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="text-right">
                Completed sales
              </TableHead>
              <TableHead scope="col" className="text-right">
                Gross sales
              </TableHead>
              <TableHead scope="col" className="text-right">
                Discounts
              </TableHead>
              <TableHead scope="col" className="text-right">
                Net sales
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-right">
                {salesReport.saleCount}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(salesReport.grossSalesCents)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(salesReport.totalDiscountsCents)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatMoney(salesReport.netSalesCents)}
              </TableCell>
            </TableRow>
          </TableBody>
        </AdminTable>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="min-w-0">
            <SectionHeader title="Payment mix" />
            <AdminTable label="Payment mix">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Method</TableHead>
                  <TableHead scope="col" className="text-right">
                    Payments
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesReport.payments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="whitespace-normal text-muted-foreground"
                    >
                      No payments in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  salesReport.payments.map((payment) => (
                    <TableRow key={payment.paymentMethod}>
                      <TableCell className="font-semibold">
                        {formatPaymentMethod(payment.paymentMethod)}
                      </TableCell>
                      <TableCell className="text-right">
                        {payment.count}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(payment.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </AdminTable>
          </section>
          <section className="min-w-0">
            <SectionHeader title="Product sales" />
            <AdminTable label="Product sales">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Product</TableHead>
                  <TableHead scope="col" className="text-right">
                    Quantity sold
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    Revenue
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesReport.products.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="whitespace-normal text-muted-foreground"
                    >
                      No products sold in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  salesReport.products.slice(0, 8).map((product) => (
                    <TableRow key={product.productName}>
                      <TableCell className="min-w-36 max-w-64 whitespace-normal break-words font-semibold">
                        {product.productName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQuantity(product.quantity)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatMoney(product.revenueCents)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </AdminTable>
          </section>
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
        <section>
          <SectionHeader title="Location profitability" />
          <AdminTable label="Location profitability">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Location</TableHead>
                <TableHead scope="col" className="text-right">
                  Closed shifts
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Gross sales
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Total costs
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Net profit / loss
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Average per shift
                </TableHead>
                <TableHead scope="col">Rent again?</TableHead>
                <TableHead scope="col">Profit/loss trend</TableHead>
                <TableHead scope="col" className="text-right">
                  Best shift
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Worst shift
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((location) => (
                <TableRow key={location.locationId}>
                  <TableCell className="min-w-44 max-w-64 whitespace-normal break-words font-semibold">
                    {location.locationName}
                  </TableCell>
                  <TableCell className="text-right">
                    {location.totalShifts}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(location.grossSalesCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(location.totalCostsCents)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatMoney(location.netProfitCents)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(location.averageProfitPerShiftCents)}
                  </TableCell>
                  <TableCell>
                    <LocationProfitBadge
                      recommendation={location.recommendation}
                    />
                  </TableCell>
                  <TableCell className="min-w-48 whitespace-normal">
                    <details>
                      <summary className="min-h-11 cursor-pointer content-center capitalize underline-offset-4 hover:underline">
                        {location.trendDirection.replaceAll("_", " ")}
                        <span className="sr-only">
                          {" "}
                          profit/loss trend for {location.locationName}
                        </span>
                      </summary>
                      <Trend
                        profits={location.trend.map(
                          (point) => point.profitCents,
                        )}
                      />
                    </details>
                  </TableCell>
                  <TableCell className="text-right">
                    {location.bestShift ? (
                      <Link
                        className="inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline"
                        href={`/admin/shifts/${location.bestShift.shiftId}`}
                      >
                        {formatMoney(location.bestShift.profitCents)}
                        <span className="sr-only">
                          {" "}
                          best shift for {location.locationName}
                        </span>
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {location.worstShift ? (
                      <ProfitBadge
                        result={location.worstShift.result}
                        amount={formatMoney(location.worstShift.profitCents)}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </AdminTable>
        </section>
      )}
    </div>
  );
}
