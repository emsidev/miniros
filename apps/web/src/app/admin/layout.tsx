import { redirect } from "next/navigation";
import { AdminShell } from "@/components/shared/admin-shell";
import { AccessError, requireActiveBusiness } from "@/server/services/access";
import { listBusinesses } from "@/server/services/businesses";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let access;

  try {
    access = await requireActiveBusiness({ admin: true });
  } catch (error) {
    if (error instanceof AccessError) {
      if (error.message === "Please sign in to continue.") {
        redirect("/login");
      }

      if (
        error.message === "Select an active business to continue." ||
        error.message === "You do not have access to this business."
      ) {
        redirect("/businesses");
      }

      redirect("/shifts");
    }

    throw error;
  }

  const businesses = await listBusinesses();

  return (
    <AdminShell
      businessId={access.business.id}
      businessFeatures={access.business.features}
      businesses={businesses}
      membershipRole={access.membership.role}
      employeePermissions={access.employee}
    >
      {children}
    </AdminShell>
  );
}
