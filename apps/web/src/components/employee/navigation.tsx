"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Ellipsis, CalendarDays, ShoppingCart } from "lucide-react";
import type { BusinessFeatureFlags } from "@miniros/domain";
import { shiftWorkspaceHref } from "./shift-presentation";
import { useNavigationShift } from "./navigation-context";
import { cn } from "@/lib/utils";

export type EmployeePermissions = {
  canUsePos: boolean;
  canLogProduction: boolean;
};
const items = [
  { href: "/shifts", label: "Shift", icon: CalendarDays },
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/more", label: "More", icon: Ellipsis },
];

export function EmployeeNavigation({
  permissions,
  desktop = false,
  pathnameOverride,
  shiftOverride,
  onNavigate,
}: {
  permissions?: EmployeePermissions;
  features?: BusinessFeatureFlags;
  desktop?: boolean;
  pathnameOverride?: string;
  shiftOverride?: { id: string; status: string } | null;
  onNavigate?: (href: string) => void;
}) {
  const routerPathname = usePathname();
  const pathname = pathnameOverride ?? routerPathname;
  const searchParams = useSearchParams();
  const contextShift = useNavigationShift();
  const selectedShift =
    shiftOverride === undefined ? contextShift : shiftOverride;
  const requestedShiftId = searchParams.get("shift");
  const productionOnly =
    permissions?.canLogProduction && !permissions.canUsePos;
  const visibleItems = items.filter((item) => {
    if (productionOnly) return item.href === "/more";
    if (item.href === "/pos") return permissions?.canUsePos;
    return true;
  });
  return (
    <nav
      aria-label="Employee navigation"
      className={
        desktop
          ? "hidden border-t bg-card md:block"
          : "safe-bottom fixed inset-x-0 bottom-0 z-[var(--mi-z-sticky)] border-t bg-card px-2 pt-2 md:hidden"
      }
    >
      <ul
        className={cn(
          "mx-auto grid gap-1",
          desktop ? "max-w-6xl px-6 py-2" : "max-w-lg",
        )}
        style={{
          gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))`,
        }}
      >
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const active =
            (href === "/more" &&
              ["/profile", "/help", "/sync", "/install"].includes(pathname)) ||
            (href === "/shifts" && pathname === "/inventory") ||
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/shifts" && pathname === "/schedule");
          const destination =
            href === "/shifts" && selectedShift
              ? `/shifts/${selectedShift.id}`
              : href === "/pos" &&
                  selectedShift &&
                  selectedShift.status !== "active"
                ? `/shifts/${selectedShift.id}`
                : shiftWorkspaceHref(href, selectedShift, requestedShiftId);
          return (
            <li key={href}>
              <Link
                href={destination}
                prefetch={onNavigate ? false : undefined}
                onClick={(event) => {
                  if (
                    !onNavigate ||
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  onNavigate(destination);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-1 rounded-md px-1 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2",
                  desktop ? "flex-row gap-2 text-sm" : "flex-col",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
