"use client";
import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { RealtimeRefresh } from "./realtime-refresh";
import { BusinessSelector, type BusinessOption } from "./business-selector";
import { ViewSelector } from "./view-selector";
import {
  isAdminMemberRole,
  type BusinessFeatureFlags,
  type MemberRole,
} from "@miniros/domain";
import { EmployeeShellFrame } from "./employee-shell-frame";

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
  const productionOnly = Boolean(
    employeePermissions?.canLogProduction && !employeePermissions.canUsePos,
  );
  const workspaceHome = productionOnly ? "/production" : "/shifts";
  const canAccessAdmin = isAdminMemberRole(membershipRole);
  return (
    <EmployeeShellFrame
      workspaceHome={workspaceHome}
      businessFeatures={businessFeatures}
      employeePermissions={employeePermissions}
      businessControl={
        <BusinessSelector
          businesses={businesses}
          businessId={businessId}
          currentView="employee"
          className="h-11 min-w-0 flex-1 shadow-none sm:max-w-64 [&_[data-slot=select-value]]:min-w-0"
        />
      }
      viewControl={
        <ViewSelector
          currentView="employee"
          canAccessAdmin={canAccessAdmin}
          employeePermissions={employeePermissions ?? null}
          className="h-11 w-11 shrink-0 px-2 shadow-none [&>svg:last-child]:hidden sm:[&>svg:last-child]:block sm:w-40 sm:px-3 [&_[data-slot=select-value]]:hidden sm:[&_[data-slot=select-value]]:flex"
        />
      }
      route={{ pathname }}
    >
      {children}
      <RealtimeRefresh businessId={businessId} />
    </EmployeeShellFrame>
  );
}
