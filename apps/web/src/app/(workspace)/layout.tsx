import { redirect } from "next/navigation";

import { AppShell } from "@/components/shared/app-shell";
import { AccessError, requireActiveBusiness } from "@/server/services/access";
import { listBusinesses } from "@/server/services/businesses";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    const { business, employee, membership } = await requireActiveBusiness();
    if (!employee) redirect("/businesses");
    const businesses = await listBusinesses();

    return (
      <AppShell
        businessId={business.id}
        businesses={businesses}
        businessFeatures={business.features}
        membershipRole={membership.role}
        employeePermissions={employee}
      >
        {children}
      </AppShell>
    );
  } catch (error) {
    if (error instanceof AccessError) redirect("/businesses");
    throw error;
  }
}
