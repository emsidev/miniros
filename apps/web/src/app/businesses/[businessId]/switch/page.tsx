import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listBusinesses } from "@/server/services/businesses";
import { SwitchBusinessForm } from "../../_components/switch-business-form";

export const metadata: Metadata = {
  title: "Switch business",
};

export const dynamic = "force-dynamic";

export default async function SwitchBusinessPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const businesses = await listBusinesses();
  const business = businesses.find((item) => item.id === businessId);

  if (!business) {
    notFound();
  }

  const destination =
    business.role === "owner" || business.role === "admin"
      ? "/admin/dashboard"
      : business.canLogProduction && !business.canUsePos
        ? "/production"
        : "/shifts";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Button asChild variant="ghost" className="-ml-2">
        <Link href="/businesses">
          <ArrowLeft aria-hidden="true" />
          Back to businesses
        </Link>
      </Button>
      <Card className="rounded-xl py-7 text-center shadow-none">
        <CardHeader className="items-center px-6 sm:px-8">
          <span className="mb-2 grid size-14 place-items-center rounded-xl bg-muted">
            <Building2 className="size-6" aria-hidden="true" />
          </span>
          <CardTitle className="text-2xl font-extrabold tracking-tight">
            Switch to {business.name}?
          </CardTitle>
          <CardDescription>
            New actions and reports will use this business until you switch
            again.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8">
          <SwitchBusinessForm
            businessId={business.id}
            destination={destination}
          />
        </CardContent>
      </Card>
    </div>
  );
}
