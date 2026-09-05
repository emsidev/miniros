import { getSetupReadiness } from "@/server/services/setup-readiness";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  MapPin,
  PackagePlus,
  ShieldCheck,
} from "lucide-react";

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
import { formatDate, formatMoney } from "@/lib/format";
import { getAdminDashboard } from "@/server/services/analytics";

export const dynamic = "force-dynamic";

const quickActions = [
  ["/admin/shifts/new", "Plan shifts", CalendarDays],
  ["/admin/products", "Add product", PackagePlus],
  ["/admin/inventory/items", "Add inventory item", Boxes],
  ["/admin/locations", "Add location", MapPin],
] as const;

export default async function AdminDashboardPage() {
  const [dashboard, readiness] = await Promise.all([
    getAdminDashboard(),
    getSetupReadiness(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Track profit, not just sales. See whether each booth is worth renting again."
        action={
          <Button asChild className="h-11 rounded-xl">
            <Link href="/admin/shifts/new">Plan shifts</Link>
          </Button>
        }
      />

      <SetupChecklist readiness={readiness} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Today’s gross sales"
          value={formatMoney(dashboard.todayGrossSalesCents)}
          hint="Completed shift summaries"
        />
        <MetricCard
          label="Today’s profit / loss"
          value={formatMoney(dashboard.todayProfitCents)}
          hint="Sales after recorded shift costs"
          emphasis
        />
        <MetricCard
          label="Active shifts"
          value={dashboard.activeShiftCount}
          hint="Active or closing"
        />
        <MetricCard
          label="Pending approvals"
          value={dashboard.pendingApprovalCount}
          hint="Cash and inventory requests"
        />
      </div>

      <section>
        <SectionHeader
          title="Location performance"
          description="Did these locations actually make money?"
          action={
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/admin/reports">
                View report <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        />
        {dashboard.bestLocation ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <DataCard>
              <p className="text-sm text-muted-foreground">Best location</p>
              <p className="mt-1 text-lg font-extrabold">
                {dashboard.bestLocation.locationName}
              </p>
              <p className="mt-2 text-2xl font-extrabold">
                {formatMoney(dashboard.bestLocation.netProfitCents)}
              </p>
              <div className="mt-3">
                <LocationProfitBadge
                  recommendation={dashboard.bestLocation.recommendation}
                />
              </div>
            </DataCard>
            <DataCard>
              <p className="text-sm text-muted-foreground">Worst location</p>
              <p className="mt-1 text-lg font-extrabold">
                {dashboard.worstLocation?.locationName ?? "—"}
              </p>
              <p className="mt-2 text-2xl font-extrabold">
                {formatMoney(dashboard.worstLocation?.netProfitCents ?? 0)}
              </p>
              {dashboard.worstLocation ? (
                <div className="mt-3">
                  <LocationProfitBadge
                    recommendation={dashboard.worstLocation.recommendation}
                  />
                </div>
              ) : null}
            </DataCard>
          </div>
        ) : (
          <EmptyState
            title="Profitability starts with a closed shift"
            description="Record sales and submit the first closeout to see which booth is worth renting again."
            action={
              <Button asChild variant="outline" className="mt-2 rounded-xl">
                <Link href="/admin/shifts/new">Plan the first shift</Link>
              </Button>
            }
          />
        )}
      </section>

      <section>
        <SectionHeader title="Quick actions" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(([href, label, Icon]) => (
            <Button
              key={href}
              asChild
              variant="outline"
              className="h-14 justify-start rounded-xl"
            >
              <Link href={href}>
                <Icon aria-hidden="true" /> {label}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader
          title="Recent closeouts"
          action={
            dashboard.pendingApprovalCount > 0 ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/admin/approvals">
                  <ShieldCheck aria-hidden="true" /> Review approvals
                </Link>
              </Button>
            ) : undefined
          }
        />
        {dashboard.recentCloseouts.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            No shift closeouts yet.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {dashboard.recentCloseouts.map((closeout) => (
              <Link
                key={closeout.closeoutId}
                href={`/admin/shifts/${closeout.shiftId}`}
              >
                <DataCard className="flex items-center justify-between gap-4 transition-colors hover:border-foreground/30">
                  <div>
                    <p className="font-bold">{closeout.locationName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(closeout.shiftDate)}
                    </p>
                  </div>
                  {closeout.result && closeout.profitCents !== null ? (
                    <ProfitBadge
                      result={closeout.result}
                      amount={formatMoney(closeout.profitCents)}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Submitted
                    </span>
                  )}
                </DataCard>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
