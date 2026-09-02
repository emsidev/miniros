import Link from "next/link";

import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireActiveBusiness } from "@/server/services/access";

import { LogoutButton } from "../_components/logout-button";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, business, membership, employee } =
    await requireActiveBusiness();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My profile"
        description={user.email ?? "MINIROS account"}
      />
      <DataCard>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Current business</dt>
            <dd className="mt-1 font-semibold">{business.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Membership role</dt>
            <dd className="mt-1 capitalize">{membership.role}</dd>
          </div>
        </dl>
        <Button asChild variant="outline" className="mt-5 h-11 rounded-xl">
          <Link href="/businesses">Switch business</Link>
        </Button>
      </DataCard>
      <section>
        <SectionHeader title="Permissions" />
        <div className="flex flex-wrap gap-2">
          <Badge variant={employee?.canUsePos ? "default" : "secondary"}>
            POS {employee?.canUsePos ? "enabled" : "not enabled"}
          </Badge>
          <Badge variant={employee?.canLogProduction ? "default" : "secondary"}>
            Production {employee?.canLogProduction ? "enabled" : "not enabled"}
          </Badge>
        </div>
      </section>
      <LogoutButton />
    </div>
  );
}
