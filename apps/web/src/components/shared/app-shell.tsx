"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { RealtimeRefresh } from "./realtime-refresh";
import { AppBreadcrumbs } from "./breadcrumbs";
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
    <div
      className={cn(
        "min-h-screen bg-background pb-24 md:pb-8",
        isPos && "pb-20 md:pb-0",
      )}
    >
      {!isPos ? (
        <header className="sticky top-0 z-[var(--mi-z-sticky)] border-b bg-background">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
            <Link
              href={workspaceHome}
              className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight"
            >
              <BrandMark className="size-9" />
              <span className="hidden sm:inline">MINIROS</span>
            </Link>
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <BusinessSelector
                businesses={businesses}
                businessId={businessId}
                currentView="employee"
                className="w-14 shrink-0 px-2 sm:w-48 sm:px-3 [&_[data-slot=select-value]]:hidden sm:[&_[data-slot=select-value]]:flex"
              />
              <ViewSelector
                currentView="employee"
                canAccessAdmin={canAccessAdmin}
                employeePermissions={employeePermissions ?? null}
                className="w-32"
              />
            </div>
          </div>
        </header>
      ) : null}
      <main
        className={cn(
          "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6",
          isPos && "max-w-none p-0 sm:p-0",
        )}
      >
        {!isPos ? (
          <AppBreadcrumbs variant="workspace" workspaceHome={workspaceHome} />
        ) : null}
        {children}
      </main>
      <RealtimeRefresh businessId={businessId} />
      <MobileBottomNav
        features={businessFeatures}
        permissions={employeePermissions}
      />
    </div>
  );
}
