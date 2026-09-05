import { ThisDevice } from "@/features/offline/device-controls";
import Link from "next/link";
import { ArrowRight, Check, CircleUserRound, Minus } from "lucide-react";
import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui/button";
import { requireActiveBusiness } from "@/server/services/access";
import { LogoutButton } from "../_components/logout-button";
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const { user, business, membership, employee } =
    await requireActiveBusiness();
  const permissions = [
    {
      name: "Point of sale",
      description: "Start shifts, take payments, and submit closeouts.",
      enabled: !!employee?.canUsePos,
    },
    {
      name: "Production",
      description: "Record batches made from central inventory.",
      enabled:
        !!employee?.canLogProduction && business.features.productionEnabled,
    },
  ];
  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="My profile"
        description="Your account and access to this business."
      />
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <CircleUserRound
            className="size-10 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Your account</h2>
            <p className="break-words text-sm text-muted-foreground">
              {user.email ?? "MINIROS account"}
            </p>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Current business</h2>
        <div className="rounded-xl border bg-card p-5">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Business</dt>
              <dd className="mt-1 break-words font-semibold">
                {business.name}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Your role</dt>
              <dd className="mt-1 font-semibold capitalize">
                {membership.role}
              </dd>
            </div>
          </dl>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/businesses">
              Switch business
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Your access</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {permissions.map((permission) => (
            <li key={permission.name} className="flex items-start gap-3 p-5">
              {permission.enabled ? (
                <Check
                  className="mt-0.5 size-5 shrink-0 text-success"
                  aria-hidden="true"
                />
              ) : (
                <Minus
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="font-semibold">{permission.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {permission.enabled ? "Enabled" : "Not enabled"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {permission.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          An admin manages your permissions for this business.
        </p>
      </section>
      <ThisDevice />
      <div className="border-t pt-5">
        <LogoutButton />
      </div>
    </div>
  );
}
