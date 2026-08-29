import { redirect } from "next/navigation";

import { AppShell } from "@/components/shared/app-shell";
import { AccessError, requireActiveBusiness } from "@/server/services/access";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    const { business, employee } = await requireActiveBusiness();
    if (!employee) redirect("/businesses");

    return <AppShell businessName={business.name}>{children}</AppShell>;
  } catch (error) {
    if (error instanceof AccessError) redirect("/businesses");
    throw error;
  }
}
