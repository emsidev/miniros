import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Business settings"
        description="The active workspace is enforced now; editable business settings are planned for Phase 2."
      />
      <EmptyState
        title="Settings are coming next"
        description="Switch businesses from the workspace selector in the meantime."
      />
    </div>
  );
}
