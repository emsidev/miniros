import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";

export default function AdminPromosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Promos"
        description="Simple fixed and percentage promo management is deferred to Phase 2."
      />
      <EmptyState
        title="Promo management is coming next"
        description="Manual discounts are available in POS for the Phase 1 workflow."
      />
    </div>
  );
}
