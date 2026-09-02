import Link from "next/link";
import type { ReactNode } from "react";
import { UserPlus } from "lucide-react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { RealtimeRefresh } from "./realtime-refresh";
import { BusinessSelector } from "./business-selector";
import { ViewSelector } from "./view-selector";
import { AdminSidebar } from "./admin-sidebar";
import { AppBreadcrumbs } from "./breadcrumbs";
import type { BusinessFeatureFlags, MemberRole } from "@miniros/domain";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand-mark";

export function AdminShell({
  children,
  businessId,
  businessFeatures,
  businesses,
  membershipRole,
  employeePermissions,
}: {
  children: ReactNode;
  businessId: string;
  businessFeatures: BusinessFeatureFlags;
  businesses: readonly {
    id: string;
    name: string;
    role: "owner" | "admin" | "operator" | "employee";
    canUsePos?: boolean | null;
    canLogProduction?: boolean | null;
  }[];
  membershipRole: MemberRole;
  employeePermissions: {
    canUsePos: boolean;
    canLogProduction: boolean;
  } | null;
}) {
  return (
    <div
      data-membership-role={membershipRole}
      className="min-h-screen bg-background pb-24 md:grid md:grid-cols-[250px_1fr] md:pb-0"
    >
      <aside className="hidden min-h-screen bg-sidebar px-4 py-6 text-sidebar-foreground md:block">
        <Link
          href="/admin/dashboard"
          className="mb-8 flex items-center gap-3 px-2 text-lg font-extrabold"
        >
          <BrandMark variant="inverse" className="size-9" />
          MINIROS
        </Link>
        <div className="mb-4 px-2">
          <BusinessSelector
            businesses={businesses}
            businessId={businessId}
            currentView="admin"
            variant="sidebar"
          />
        </div>
        <AdminSidebar businessFeatures={businessFeatures} />
        {!employeePermissions ? (
          <div className="mt-6 border-t border-sidebar-border pt-4">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/employees">Set up employee access</Link>
            </Button>
          </div>
        ) : null}
      </aside>
      <div>
        <header className="sticky top-0 z-[var(--mi-z-sticky)] border-b bg-background px-4 py-3 md:px-8">
          <div className="mx-auto flex min-h-10 max-w-7xl items-center gap-2">
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <Link
                href="/admin/dashboard"
                aria-label="MINIROS admin dashboard"
                className="shrink-0"
              >
                <BrandMark className="size-9" />
              </Link>
              <BusinessSelector
                businesses={businesses}
                businessId={businessId}
                currentView="admin"
                className="w-14 shrink-0 px-2 sm:w-48 sm:px-3 [&_[data-slot=select-value]]:hidden sm:[&_[data-slot=select-value]]:flex"
              />
            </div>
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <p className="hidden text-sm font-semibold xl:block">
                Track profit, not just sales.
              </p>
              <ViewSelector
                currentView="admin"
                canAccessAdmin
                employeePermissions={employeePermissions}
                className="w-32"
              />
              {!employeePermissions ? (
                <Button
                  asChild
                  size="icon-lg"
                  variant="outline"
                  className="rounded-xl md:hidden"
                >
                  <Link
                    href="/admin/employees"
                    aria-label="Set up employee access"
                    title="Set up employee access"
                  >
                    <UserPlus aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <AppBreadcrumbs variant="admin" />
          {children}
        </main>
      </div>
      <RealtimeRefresh businessId={businessId} />
      <MobileBottomNav variant="admin" features={businessFeatures} />
    </div>
  );
}
