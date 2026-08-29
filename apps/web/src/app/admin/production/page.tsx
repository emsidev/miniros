import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";

export default function AdminProductionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Production overview"
        description="Shift-level production is live in the operator workspace. Business-wide analysis is planned for Phase 2."
      />
      <EmptyState
        title="Production reporting is coming next"
        description="Operators can already log production with recipe-based inventory deductions. This admin view will add cross-shift summaries."
      />
    </div>
  );
}
