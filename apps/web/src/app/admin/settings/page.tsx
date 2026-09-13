import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { formatDateTime } from "@/lib/format";
import { getBusinessSettings } from "@/server/services/businesses";
import { BusinessSettingsForm } from "../_components/business-settings-form";
import { BusinessFeaturesForm } from "../_components/business-features-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getBusinessSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business settings"
        description="Keep the active workspace identity clear for every shift and report."
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <DataCard>
          <SectionHeader
            title="Workspace identity"
            description="This name appears in the admin shell and business switcher."
          />
          <BusinessSettingsForm name={settings.name} />
        </DataCard>
        <DataCard className="h-fit space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Workspace slug</p>
            <p className="mt-1 break-all font-semibold">
              {settings.slug ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="mt-1 font-semibold">
              {formatDateTime(settings.createdAt)}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Business membership and operational permissions remain managed by
            the server for every request.
          </p>
        </DataCard>
      </div>
      <DataCard>
        <SectionHeader
          title="Feature enablement"
          description="Choose which operational tools are available in this business."
        />
        <BusinessFeaturesForm
          features={{
            recipesEnabled: settings.recipesEnabled,
            productionEnabled: settings.productionEnabled,
            approvalsEnabled: settings.approvalsEnabled,
            promosEnabled: settings.promosEnabled,
          }}
        />
      </DataCard>
    </div>
  );
}
