"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Ellipsis,
  Sun,
  Tags,
} from "lucide-react";
import type { BusinessFeatureFlags } from "@miniros/domain";
import { cn } from "@/lib/utils";

export const ownerNavigation = [
  { href: "/admin/dashboard", label: "Today", icon: Sun },
  { href: "/admin/shifts", label: "Shifts", icon: CalendarDays },
  { href: "/admin/products", label: "Catalog", icon: Tags },
  { href: "/admin/reports", label: "Reports", icon: ChartNoAxesCombined },
  { href: "/admin/more", label: "More", icon: Ellipsis },
];
export function ownerDestinationActive(path: string, href: string) {
  if (href === "/admin/products")
    return ["/admin/products", "/admin/inventory", "/admin/promos"].some(
      (prefix) => path === prefix || path.startsWith(prefix + "/"),
    );
  if (href === "/admin/more")
    return [
      "/admin/more",
      "/admin/employees",
      "/admin/locations",
      "/admin/settings",
      "/admin/approvals",
      "/admin/devices",
      "/admin/production",
    ].some((prefix) => path === prefix || path.startsWith(prefix + "/"));
  return path === href || path.startsWith(href + "/");
}
export function AdminSidebar({}: { businessFeatures: BusinessFeatureFlags }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Owner navigation" className="space-y-1">
      {ownerNavigation.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={
            ownerDestinationActive(pathname, href) ? "page" : undefined
          }
          className={cn(
            "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2",
            ownerDestinationActive(pathname, href)
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
