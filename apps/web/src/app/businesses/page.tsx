import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listBusinesses } from "@/server/services/businesses";
import { CreateBusinessDialog } from "./_components/create-business-dialog";

export const dynamic = "force-dynamic";

export default async function BusinessesPage() {
  const businesses = await listBusinesses();

  if (businesses.length === 0) {
    return (
      <>
        <PageHeader
          title="Choose a business"
          description="Select the workspace you want to operate, or create a new one."
        />
        <EmptyState
          title="No businesses yet"
          description="Create your first workspace to start managing your retail operations."
          action={<CreateBusinessDialog />}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Choose a business"
        description="Select the workspace you want to operate, or create a new one."
        action={<CreateBusinessDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {businesses.map((business) => {
          const destination =
            business.role === "owner" || business.role === "admin"
              ? "/admin/dashboard"
              : business.canLogProduction && !business.canUsePos
                ? "/production"
                : "/shifts";

          return (
            <Card
              key={business.id}
              className="rounded-xl py-5 shadow-none transition-colors hover:border-foreground/30"
            >
              <CardHeader className="grid-cols-[1fr_auto] px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                    <Building2 className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base font-bold">
                      {business.name}
                    </CardTitle>
                    <CardDescription className="capitalize">
                      {business.role}
                    </CardDescription>
                  </div>
                </div>
                <CardAction>
                  {business.isActive ? (
                    <Badge className="bg-success-surface text-success">
                      Active
                    </Badge>
                  ) : null}
                </CardAction>
              </CardHeader>
              <CardContent className="flex items-center gap-2 px-5">
                {business.isActive ? (
                  <Button asChild className="h-10 flex-1 rounded-xl">
                    <Link href={destination}>
                      Open workspace
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    className="h-10 flex-1 rounded-xl"
                  >
                    <Link href={`/businesses/${business.id}/switch`}>
                      Select business
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
