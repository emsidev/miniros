"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { switchBusinessAction } from "@/server/actions/businesses";
import { WorkspaceSelector } from "./workspace-selector";
import type { WorkspaceView } from "./view-selector";

export type BusinessOption = {
  id: string;
  name: string;
  role: "owner" | "admin" | "operator" | "employee";
  canUsePos?: boolean | null;
  canLogProduction?: boolean | null;
};

const CREATE_BUSINESS_VALUE = "__create_business__";

function hasAdminView(business: BusinessOption) {
  return business.role === "owner" || business.role === "admin";
}

function hasEmployeeView(business: BusinessOption) {
  return business.canUsePos != null || business.canLogProduction != null;
}

function employeeDestination(business: BusinessOption) {
  return business.canLogProduction && !business.canUsePos
    ? "/production"
    : "/shifts";
}

export function businessDestination(
  business: BusinessOption,
  currentView: WorkspaceView,
) {
  if (currentView === "admin" && hasAdminView(business)) {
    return "/admin/dashboard";
  }

  if (currentView === "employee" && hasEmployeeView(business)) {
    return employeeDestination(business);
  }

  if (hasAdminView(business)) return "/admin/dashboard";
  if (hasEmployeeView(business)) return employeeDestination(business);
  return "/businesses";
}

export function BusinessSelector({
  businesses,
  businessId,
  currentView,
  variant = "header",
  className,
}: {
  businesses: readonly BusinessOption[];
  businessId: string;
  currentView: WorkspaceView;
  variant?: "header" | "sidebar";
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId);

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId]);

  function switchBusiness(nextBusinessId: string) {
    if (nextBusinessId === CREATE_BUSINESS_VALUE) {
      router.push("/businesses");
      return;
    }

    if (nextBusinessId === businessId) return;
    const business = businesses.find((item) => item.id === nextBusinessId);
    if (!business) return;

    setSelectedBusinessId(nextBusinessId);
    startTransition(async () => {
      const result = await switchBusinessAction(nextBusinessId);
      if (!result.ok) {
        setSelectedBusinessId(businessId);
        toast.error(result.error);
        return;
      }

      router.replace(businessDestination(business, currentView));
      router.refresh();
    });
  }

  return (
    <WorkspaceSelector
      value={selectedBusinessId}
      onValueChange={switchBusiness}
      options={businesses.map((business) => ({
        value: business.id,
        label: business.name,
        meta: business.role,
        icon: Building2,
      }))}
      action={{
        value: CREATE_BUSINESS_VALUE,
        label: "Create new business",
        icon: Plus,
      }}
      icon={Building2}
      ariaLabel="Switch business"
      placeholder="Select business"
      variant={variant}
      pending={isPending}
      className={className}
    />
  );
}
