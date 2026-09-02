"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

type Breadcrumb = { label: string; href?: string };

const adminLabels: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Employees",
  products: "Products",
  categories: "Categories",
  promos: "Promos",
  inventory: "Inventory",
  items: "Inventory items",
  recipes: "Product recipes",
  stock: "Stock movements",
  production: "Production",
  locations: "Locations",
  shifts: "Shifts",
  approvals: "Approvals",
  reports: "Reports",
  settings: "Settings",
};

const workspaceLabels: Record<string, string> = {
  shifts: "My shifts",
  schedule: "My schedule",
  pos: "Point of sale",
  production: "Production",
  inventory: "Inventory",
  profile: "My profile",
  start: "Start shift",
  close: "Close shift",
};

function isShiftIdentifier(segment: string) {
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(segment);
}

function getAdminBreadcrumbs(pathname: string): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const crumbs: Breadcrumb[] = [{ label: "Admin", href: "/admin/dashboard" }];
  let href = "/admin";

  for (const segment of segments) {
    href += `/${segment}`;
    const isDetail = isShiftIdentifier(segment);
    crumbs.push({
      label: isDetail ? "Shift details" : (adminLabels[segment] ?? "Details"),
      href: isDetail ? undefined : href,
    });
  }

  return crumbs;
}

function getWorkspaceBreadcrumbs(
  pathname: string,
  workspaceHome = "/shifts",
): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Breadcrumb[] = [{ label: "Workspace", href: workspaceHome }];
  let href = "";

  for (const segment of segments) {
    href += `/${segment}`;
    const isDetail = isShiftIdentifier(segment);
    crumbs.push({
      label: isDetail
        ? "Shift details"
        : (workspaceLabels[segment] ?? "Details"),
      href: isDetail ? undefined : href,
    });
  }

  return crumbs;
}

export function AppBreadcrumbs({
  variant,
  workspaceHome,
}: {
  variant: "admin" | "workspace";
  workspaceHome?: string;
}) {
  const pathname = usePathname();
  const breadcrumbs =
    variant === "admin"
      ? getAdminBreadcrumbs(pathname)
      : getWorkspaceBreadcrumbs(pathname, workspaceHome);

  return (
    <nav aria-label="Breadcrumb" className="mb-5 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-1 text-sm text-muted-foreground">
        {breadcrumbs.map((breadcrumb, index) => {
          const isCurrent = index === breadcrumbs.length - 1;
          return (
            <li
              key={`${breadcrumb.label}-${index}`}
              className="flex items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRight
                  className="size-3.5 shrink-0"
                  aria-hidden="true"
                />
              ) : null}
              {breadcrumb.href && !isCurrent ? (
                <Link
                  href={breadcrumb.href}
                  className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {breadcrumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className={
                    isCurrent ? "font-semibold text-foreground" : undefined
                  }
                >
                  {breadcrumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
