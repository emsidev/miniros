"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  CircleUserRound,
  PackageOpen,
  ShoppingCart,
} from "lucide-react";
import type { BusinessFeatureFlags } from "@miniros/domain";
import { shiftWorkspaceHref } from "./shift-presentation";
import { useNavigationShift } from "./navigation-context";
import { cn } from "@/lib/utils";

export type EmployeePermissions = {
  canUsePos: boolean;
  canLogProduction: boolean;
};
const items = [
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/production", label: "Production", icon: PackageOpen },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
];

export function EmployeeNavigation({
  permissions,
  features,
  desktop = false,
}: {
  permissions?: EmployeePermissions;
  features?: BusinessFeatureFlags;
  desktop?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedShift = useNavigationShift();
  const requestedShiftId = searchParams.get("shift");
  const productionOnly =
    permissions?.canLogProduction && !permissions.canUsePos;
  const visibleItems = items.filter((item) => {
    if (productionOnly)
      return item.href === "/production" || item.href === "/profile";
    if (item.href === "/pos") return permissions?.canUsePos;
    if (item.href === "/production")
      return (
        permissions?.canLogProduction && features?.productionEnabled !== false
      );
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
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/shifts" && pathname === "/schedule");
          const destination = shiftWorkspaceHref(
            href,
            selectedShift,
            requestedShiftId,
          );
          return (
            <li key={href}>
              <Link
                href={destination}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2",
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
