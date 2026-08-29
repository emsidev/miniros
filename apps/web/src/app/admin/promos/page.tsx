import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { formatDate } from "@/lib/format";
import { listPromos } from "@/server/services/promos";
import { PromoForm } from "../_components/promo-form";
import { PromoStatusButton } from "../_components/promo-status-button";

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  const promos = await listPromos();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promos"
        description="Create simple fixed or percentage discounts for live booth selling."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <DataCard>
          <SectionHeader
            title="New promo"
            description="Keep the offer easy for an operator to understand."
          />
          <PromoForm />
        </DataCard>
        <section className="space-y-3">
          <SectionHeader title="Saved promos" />
          {promos.length === 0 ? (
            <EmptyState
              title="No promos yet"
              description="Create a fixed-amount or percentage discount when you need one."
            />
          ) : (
            promos.map((promo) => (
              <DataCard
                key={promo.id}
                className="flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{promo.name}</h2>
                    <StatusBadge status={promo.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {promo.discountType === "fixed_amount"
                      ? `₱${promo.discountValue.toFixed(2)} off`
                      : `${promo.discountValue}% off`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {promo.startsAt ? formatDate(promo.startsAt) : "Any date"} →{" "}
                    {promo.endsAt ? formatDate(promo.endsAt) : "No end date"}
                  </p>
                </div>
                <PromoStatusButton promoId={promo.id} status={promo.status} />
              </DataCard>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
