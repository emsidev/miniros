import Link from "next/link";
import type { ReactNode } from "react";
import {
  Boxes,
  BadgePercent,
  CalendarDays,
  ChartNoAxesCombined,
  LayoutDashboard,
  MapPin,
  PackageOpen,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  UsersRound,
} from "lucide-react";
import { MobileBottomNav } from "./mobile-bottom-nav";

const items = [
  ["/admin/dashboard", "Dashboard", LayoutDashboard],
  ["/admin/employees", "Employees", UsersRound],
  ["/admin/products", "Products", Tags],
  ["/admin/promos", "Promos", BadgePercent],
  ["/admin/inventory", "Inventory", Boxes],
  ["/admin/production", "Production", PackageOpen],
  ["/admin/locations", "Locations", MapPin],
  ["/admin/shifts", "Shifts", CalendarDays],
  ["/admin/approvals", "Approvals", ShieldCheck],
  ["/admin/reports", "Reports", ChartNoAxesCombined],
  ["/admin/settings", "Settings", Settings],
] as const;

export function AdminShell({
  children,
  businessName,
}: {
  children: ReactNode;
  businessName: string;
}) {
  return (
    <div className="min-h-screen bg-background pb-24 md:grid md:grid-cols-[250px_1fr] md:pb-0">
      <aside className="hidden min-h-screen bg-sidebar px-4 py-6 text-sidebar-foreground md:block">
        <Link
          href="/admin/dashboard"
          className="mb-8 flex items-center gap-3 px-2 text-lg font-extrabold"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Store className="size-5" aria-hidden="true" />
          </span>
          MINIROS
        </Link>
        <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">
          {businessName}
        </p>
        <nav aria-label="Admin navigation" className="space-y-1">
          {items.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div>
        <header className="sticky top-0 z-40 border-b bg-background/90 px-4 py-4 backdrop-blur md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="md:hidden">
              <p className="font-extrabold">MINIROS</p>
              <p className="text-xs text-muted-foreground">{businessName}</p>
            </div>
            <p className="ml-auto text-sm font-semibold">
              Track profit, not just sales.
            </p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
      <MobileBottomNav variant="admin" />
    </div>
  );
}
