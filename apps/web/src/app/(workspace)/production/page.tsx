import { EmptyState } from "@/components/shared/feedback";
import { FeatureUnavailable } from "@/components/shared/feature-unavailable";
import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { getProductionWorkspace } from "@/server/services/operator-workspaces";
import { ProductionForm } from "./production-form";
import { requireActiveBusiness } from "@/server/services/access";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const { business } = await requireActiveBusiness();
  if (!business.features.productionEnabled) {
    return (
      <FeatureUnavailable
        feature="Production"
        destination="/profile"
        destinationLabel="Go to profile"
      />
    );
  }

  const workspace = await getProductionWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production"
        description="Make finished goods from central inventory. Recipe inputs and output stock are recorded together."
      />
      {workspace.inventoryLocations.length === 0 ? (
        <EmptyState
          title="No central inventory location"
          description="Ask an admin to create an active central inventory location before logging production."
        />
      ) : workspace.products.length === 0 ? (
        <EmptyState
          title="No producible products available"
          description="Ask an admin to add a recipe and map its output to a tracked finished-good inventory item."
        />
      ) : (
        <ProductionForm
          inventoryLocations={workspace.inventoryLocations}
          products={workspace.products}
        />
      )}
      <section>
        <SectionHeader title="Recent production" />
        {workspace.recentLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No production logged yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workspace.recentLogs.map((log) => (
              <DataCard key={log.id}>
                <p className="font-bold">{log.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatQuantity(log.quantityProduced)} {log.unit} ·{" "}
                  {formatDateTime(log.createdAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {log.inventoryLocationName ??
                    "Inventory location unavailable"}
                </p>
              </DataCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
