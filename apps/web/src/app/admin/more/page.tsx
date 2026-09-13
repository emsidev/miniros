import Link from "next/link";
import { PageHeader } from "@/components/shared/layout";
import { requireActiveBusiness } from "@/server/services/access";
import { ArrowRight } from "lucide-react";
export default async function OwnerMorePage() {
  const { business } = await requireActiveBusiness({ admin: true });
  const tools = [
    ["/admin/employees", "People & selling access"],
    ["/admin/locations", "Venues & costs"],
    ["/admin/approvals", "Pending reviews"],
    ["/admin/devices", "Offline devices & recovery"],
    ["/admin/settings", "Business settings"],
    ...(business.features.productionEnabled
      ? [["/admin/production", "Production · optional"]]
      : []),
  ];
  return (
    <section className="space-y-6">
      <PageHeader title="More" description="Setup, reviews, and recovery." />
      <div className="divide-y border-y">
        {tools.map(([href, label]) => (
          <Link
            key={href}
            href={href!}
            className="flex min-h-14 items-center justify-between gap-4 py-4 font-semibold"
          >
            {label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
