"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  CircleUserRound,
  LayoutDashboard,
  PackageOpen,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusinessFeatureFlags } from "@miniros/domain";

const operatorItems = [
  { href: "/shifts", label: "Shifts", icon: CalendarDays, permission: "base" },
  { href: "/pos", label: "Sell", icon: ShoppingCart, permission: "pos" },
  {
    href: "/production",
    label: "Production",
    icon: PackageOpen,
    permission: "production",
  },
  { href: "/inventory", label: "Inventory", icon: Boxes, permission: "base" },
  {
    href: "/profile",
    label: "Profile",
    icon: CircleUserRound,
    permission: "base",
  },
] as const;

const adminItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/reports", label: "Reports", icon: ChartNoAxesCombined },
  { href: "/admin/employees", label: "Team", icon: UsersRound },
];

export function MobileBottomNav({
  variant = "operator",
  features,
  permissions,
}: {
  variant?: "operator" | "admin";
  features?: BusinessFeatureFlags;
  permissions?: { canUsePos: boolean; canLogProduction: boolean };
}) {
  const pathname = usePathname();
  const productionOnly = Boolean(
    permissions?.canLogProduction && !permissions.canUsePos,
  );
  const items =
    variant === "admin"
      ? adminItems
      : productionOnly
        ? operatorItems.filter(
            (item) => item.href === "/production" || item.href === "/profile",
          )
        : operatorItems.filter((item) => {
            if (item.permission === "pos" && !permissions?.canUsePos) {
              return false;
            }
            if (
              item.permission === "production" &&
              (!permissions?.canLogProduction ||
                features?.productionEnabled === false)
            ) {
              return false;
            }
            return true;
          });

  return (
    <nav
      aria-label="Primary navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-[var(--mi-z-sticky)] border-t bg-card px-2 pt-2 md:hidden"
    >
      <ul
        className="mx-auto grid max-w-lg gap-1"
        style={{
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        }}
      >
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-xs font-medium text-muted-foreground transition-colors duration-[var(--mi-motion-fast)] after:absolute after:bottom-0 after:size-1 after:rounded-full after:bg-transparent",
                  active &&
                    "text-foreground after:bg-[var(--mi-color-accent-active)]",
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
