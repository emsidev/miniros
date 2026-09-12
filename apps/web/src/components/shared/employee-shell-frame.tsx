"use client";

import Link from "next/link";
import { Suspense, type MouseEvent, type ReactNode } from "react";
import type { BusinessFeatureFlags } from "@miniros/domain";
import { EmployeeNavigation } from "@/components/employee/navigation";
import { EmployeeNavigationProvider } from "@/components/employee/navigation-context";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { SyncStatusButton } from "@/features/offline/device-controls";
import { WorkspaceHeader } from "./workspace-header";

export type EmployeeShellRoute = {
  pathname: string;
  shift?: { id: string; status: string } | null;
  onNavigate?: (href: string) => void;
  identityKey?: string;
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
    <EmployeeNavigationProvider identityKey={route.identityKey}>
      <div
        className={cn(
          "employee-workspace min-h-dvh bg-background pb-[calc(var(--mi-staff-nav-height)+var(--mi-space-6)+env(safe-area-inset-bottom))] md:pb-8",
          isPos && "pb-20 md:pb-0",
        )}
      >
        {
          <WorkspaceHeader className="sticky top-0 z-[var(--mi-z-sticky)] border-b bg-background">
            <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:gap-3 sm:px-6">
              <Link
                href={workspaceHome}
                onClick={navigate}
                prefetch={route.onNavigate ? false : undefined}
                aria-label="MINIROS employee home"
                className="flex min-h-12 shrink-0 items-center gap-2 rounded-md font-extrabold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <BrandMark className="size-9" />
                <span className="hidden sm:inline">MINIROS</span>
              </Link>
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
                <SyncStatusButton always />
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
        }
        <main
          className={cn(
            "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6",
            isPos && "max-w-none p-0 sm:p-0",
          )}
        >
          {children}
          {route.pathname === "/more" ? (
            <section
              className="mt-8 space-y-3 border-t pt-6"
              aria-label="Workspace controls"
            >
              <h2 className="text-lg font-bold">Business & view</h2>
              <div className="flex flex-wrap gap-3">
                {businessControl}
                {viewControl}
              </div>
            </section>
          ) : null}
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
