"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  MapPin,
  PackageOpen,
  Settings,
  ShieldCheck,
  Tags,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  isBusinessFeatureEnabled,
  type BusinessFeatureFlags,
  type BusinessFeatureKey,
} from "@miniros/domain";
import { cn } from "@/lib/utils";

type DirectNavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  feature?: BusinessFeatureKey;
};

type GroupNavigationItem = {
  label: string;
  icon: LucideIcon;
  children: readonly { href: string; label: string }[];
};

const navigationItems: readonly (DirectNavigationItem | GroupNavigationItem)[] =
  [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/employees", label: "Employees", icon: UsersRound },
    {
      label: "Products",
      icon: Tags,
      children: [
        { href: "/admin/products", label: "All products" },
        { href: "/admin/products/categories", label: "Categories" },
      ],
    },
    {
      href: "/admin/promos",
      label: "Promos",
      icon: BadgePercent,
      feature: "promos",
    },
    {
      label: "Inventory",
      icon: Boxes,
      children: [
        { href: "/admin/inventory", label: "Overview" },
        { href: "/admin/inventory/items", label: "Inventory items" },
        { href: "/admin/inventory/recipes", label: "Product recipes" },
        { href: "/admin/inventory/stock", label: "Stock movements" },
      ],
    },
    {
      href: "/admin/production",
      label: "Production",
      icon: PackageOpen,
      feature: "production",
    },
    { href: "/admin/locations", label: "Locations", icon: MapPin },
    { href: "/admin/shifts", label: "Shifts", icon: CalendarDays },
    {
      href: "/admin/approvals",
      label: "Approvals",
      icon: ShieldCheck,
      feature: "approvals",
    },
    { href: "/admin/reports", label: "Reports", icon: ChartNoAxesCombined },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isGroupChildActive(
  pathname: string,
  child: { href: string },
  firstChildHref: string,
) {
  return child.href === firstChildHref
    ? pathname === child.href
    : isActive(pathname, child.href);
}

export function AdminSidebar({
  businessFeatures,
}: {
  businessFeatures: BusinessFeatureFlags;
}) {
  const pathname = usePathname();
  const activeGroups = useMemo(
    () =>
      navigationItems
        .filter((item): item is GroupNavigationItem => "children" in item)
        .filter((item) =>
          item.children.some((child) =>
            isGroupChildActive(pathname, child, item.children[0].href),
          ),
        )
        .map((item) => item.label),
    [pathname],
  );
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroups);

  useEffect(() => {
    setOpenGroups((groups) =>
      Array.from(new Set([...groups, ...activeGroups])),
    );
  }, [activeGroups]);

  const visibleItems = navigationItems.filter((item) => {
    if (!("feature" in item) || !item.feature) return true;
    return isBusinessFeatureEnabled(businessFeatures, item.feature);
  });

  return (
    <nav aria-label="Admin navigation" className="space-y-1">
      {visibleItems.map((item) => {
        if ("children" in item) {
          const expanded = openGroups.includes(item.label);
          const active = item.children.some((child) =>
            isGroupChildActive(pathname, child, item.children[0].href),
          );
          const groupId = `admin-navigation-${item.label.toLowerCase().replace(/\s+/g, "-")}`;
          const Icon = item.icon;

          return (
            <div key={item.label}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={groupId}
                onClick={() =>
                  setOpenGroups((groups) =>
                    expanded
                      ? groups.filter((group) => group !== item.label)
                      : [...groups, item.label],
                  )
                }
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors duration-[var(--mi-motion-fast)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/75",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    expanded && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
              {expanded ? (
                <div id={groupId} className="mt-1 space-y-1 pl-6">
                  {item.children.map((child) => {
                    const childActive = isGroupChildActive(
                      pathname,
                      child,
                      item.children[0].href,
                    );
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={childActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-9 items-center rounded-lg px-3 text-sm transition-colors duration-[var(--mi-motion-fast)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          childActive
                            ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/65",
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        }

        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-[var(--mi-motion-fast)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/75",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
