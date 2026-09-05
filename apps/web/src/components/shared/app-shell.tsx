"use client";
import { WorkspaceHeader } from "./workspace-header";
import { SyncStatusButton } from "@/features/offline/device-controls";

import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { EmployeeNavigationProvider } from "@/components/employee/navigation-context";
import { EmployeeNavigation } from "@/components/employee/navigation";
import { RealtimeRefresh } from "./realtime-refresh";
import { BrandMark } from "./brand-mark";
import { BusinessSelector, type BusinessOption } from "./business-selector";
import { ViewSelector } from "./view-selector";
import {
  isAdminMemberRole,
  type BusinessFeatureFlags,
  type MemberRole,
} from "@miniros/domain";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  businessId,
  businesses,
  businessFeatures,
  membershipRole,
  employeePermissions,
}: {
  children: ReactNode;
  businessId: string;
  businesses: readonly BusinessOption[];
  businessFeatures?: BusinessFeatureFlags;
  membershipRole?: MemberRole;
  employeePermissions?: { canUsePos: boolean; canLogProduction: boolean };
}) {
  const pathname = usePathname();
  const isPos = pathname === "/pos" || pathname.startsWith("/pos?");
  const productionOnly = Boolean(
    employeePermissions?.canLogProduction && !employeePermissions.canUsePos,
  );
  const workspaceHome = productionOnly ? "/production" : "/shifts";
  const canAccessAdmin = isAdminMemberRole(membershipRole);
  return (
    <EmployeeNavigationProvider>
      <div
        className={cn(
          "employee-workspace min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8",
          isPos && "pb-20 md:pb-0",
        )}
      >
        {!isPos ? (
          <WorkspaceHeader className="sticky top-0 z-[var(--mi-z-sticky)] border-b bg-background">
            <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6">
              <Link
                href={workspaceHome}
                aria-label="MINIROS employee home"
                className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight"
              >
                <BrandMark className="size-9" />
                <span className="hidden sm:inline">MINIROS</span>
              </Link>
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
                <BusinessSelector
                  businesses={businesses}
                  businessId={businessId}
                  currentView="employee"
                  className="h-11 min-w-0 flex-1 shadow-none sm:max-w-64 [&_[data-slot=select-value]]:min-w-0"
                />
                <SyncStatusButton />
                <ViewSelector
                  currentView="employee"
                  canAccessAdmin={canAccessAdmin}
                  employeePermissions={employeePermissions ?? null}
                  className="h-11 w-11 shrink-0 px-2 shadow-none [&>svg:last-child]:hidden sm:[&>svg:last-child]:block sm:w-40 sm:px-3 [&_[data-slot=select-value]]:hidden sm:[&_[data-slot=select-value]]:flex"
                />
              </div>
            </div>
            <Suspense fallback={null}>
              <EmployeeNavigation
                desktop
                features={businessFeatures}
                permissions={employeePermissions}
              />
            </Suspense>
          </WorkspaceHeader>
        ) : null}
        <main
          className={cn(
            "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6",
            isPos && "max-w-none p-0 sm:p-0",
          )}
        >
          {children}
        </main>
        <RealtimeRefresh businessId={businessId} />
        <Suspense fallback={null}>
          <EmployeeNavigation
            features={businessFeatures}
            permissions={employeePermissions}
          />
        </Suspense>
      </div>
    </EmployeeNavigationProvider>
  );
}
