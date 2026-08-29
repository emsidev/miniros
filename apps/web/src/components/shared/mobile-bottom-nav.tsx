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

const operatorItems = [
  { href: "/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/production", label: "Production", icon: PackageOpen },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/profile", label: "Profile", icon: CircleUserRound },
];

const adminItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/reports", label: "Reports", icon: ChartNoAxesCombined },
  { href: "/admin/employees", label: "Team", icon: UsersRound },
];

export function MobileBottomNav({
  variant = "operator",
}: {
  variant?: "operator" | "admin";
}) {
  const pathname = usePathname();
  const items = variant === "admin" ? adminItems : operatorItems;

  return (
    <nav
      aria-label="Primary navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(17,19,24,0.06)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.68rem] font-medium text-muted-foreground transition-colors",
                  active && "bg-accent text-accent-foreground",
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
