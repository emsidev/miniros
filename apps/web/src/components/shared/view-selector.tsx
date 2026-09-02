"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { WorkspaceSelector } from "./workspace-selector";

export type WorkspaceView = "employee" | "admin";

export function ViewSelector({
  currentView,
  canAccessAdmin,
  employeePermissions,
  className,
}: {
  currentView: WorkspaceView;
  canAccessAdmin: boolean;
  employeePermissions: {
    canUsePos: boolean;
    canLogProduction: boolean;
  } | null;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingView, setPendingView] = useState<WorkspaceView | null>(null);
  const employeeHref =
    employeePermissions?.canLogProduction && !employeePermissions.canUsePos
      ? "/production"
      : "/shifts";
  const options = [
    ...(employeePermissions
      ? [
          {
            value: "employee",
            label: "Employee",
            icon: UserRound,
          } as const,
        ]
      : []),
    ...(canAccessAdmin
      ? [
          {
            value: "admin",
            label: "Admin",
            icon: ShieldCheck,
          } as const,
        ]
      : []),
  ];

  if (!canAccessAdmin) return null;

  function switchView(nextView: string) {
    if (nextView !== "admin" && nextView !== "employee") return;
    if (nextView === currentView) return;
    const destination =
      nextView === "admin" ? "/admin/dashboard" : employeeHref;

    setPendingView(nextView);
    startTransition(() => {
      router.push(destination);
    });
  }

  return (
    <WorkspaceSelector
      value={pendingView ?? currentView}
      onValueChange={switchView}
      options={options}
      icon={UsersRound}
      ariaLabel="Switch view"
      placeholder="Select view"
      pending={isPending}
      className={className ?? "w-32"}
      contentClassName="w-(--radix-select-trigger-width) min-w-40"
    />
  );
}
