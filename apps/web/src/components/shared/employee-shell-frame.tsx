"use client";

import Link from "next/link";
import { Suspense, type MouseEvent, type ReactNode } from "react";
import type { BusinessFeatureFlags } from "@miniros/domain";
import { EmployeeNavigation } from "@/components/employee/navigation";
import { EmployeeNavigationProvider } from "@/components/employee/navigation-context";
import { SyncStatusButton } from "@/features/offline/device-controls";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { WorkspaceHeader } from "./workspace-header";

export type EmployeeShellRoute = {
  pathname: string;
  shift?: { id: string; status: string } | null;
  onNavigate?: (href: string) => void;
};

export function EmployeeShellFrame({
  children,
  workspaceHome,
  businessControl,
  viewControl,
  businessFeatures,
  employeePermissions,
  route,
}: {
  children: ReactNode;
  workspaceHome: string;
  businessControl: ReactNode;
  viewControl?: ReactNode;
  businessFeatures?: BusinessFeatureFlags;
  employeePermissions?: { canUsePos: boolean; canLogProduction: boolean };
  route: EmployeeShellRoute;
}) {
  const isPos = route.pathname === "/pos";
  const navigate = route.onNavigate
    ? (event: MouseEvent<HTMLAnchorElement>) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        route.onNavigate?.(workspaceHome);
      }
    : undefined;

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
                onClick={navigate}
                prefetch={route.onNavigate ? false : undefined}
                aria-label="MINIROS employee home"
                className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight"
              >
                <BrandMark className="size-9" />
                <span className="hidden sm:inline">MINIROS</span>
              </Link>
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
                {businessControl}
                <SyncStatusButton />
                {viewControl}
              </div>
            </div>
            <Suspense fallback={null}>
              <EmployeeNavigation
                desktop
                features={businessFeatures}
                permissions={employeePermissions}
                pathnameOverride={route.pathname}
                shiftOverride={route.shift}
                onNavigate={route.onNavigate}
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
        <Suspense fallback={null}>
          <EmployeeNavigation
            features={businessFeatures}
            permissions={employeePermissions}
            pathnameOverride={route.pathname}
            shiftOverride={route.shift}
            onNavigate={route.onNavigate}
          />
        </Suspense>
      </div>
    </EmployeeNavigationProvider>
  );
}
