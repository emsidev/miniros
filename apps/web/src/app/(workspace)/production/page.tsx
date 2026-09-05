import { EmptyState } from "@/components/shared/feedback";
import { FeatureUnavailable } from "@/components/shared/feature-unavailable";
import { PageHeader, SectionHeader } from "@/components/shared/layout";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { getProductionWorkspace } from "@/server/services/operator-workspaces";
import { ProductionForm } from "./production-form";
import { requireActiveBusiness } from "@/server/services/access";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const { business } = await requireActiveBusiness();
  if (!business.features.productionEnabled) {
    return (
      <>
        <PageHeader title="Production" />
        <FeatureUnavailable
          feature="Production"
          destination="/profile"
          destinationLabel="Go to profile"
        />
      </>
    );
  }

  const workspace = await getProductionWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production"
        description="Record the finished goods your team makes from central inventory."
      />
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
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
        </div>
        <section>
          <SectionHeader title="Recent production" />
          {workspace.recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No production logged yet.
            </p>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {workspace.recentLogs.map((log) => (
                <div key={log.id} className="p-4">
                  <p className="font-bold">{log.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatQuantity(log.quantityProduced)} {log.unit} ·{" "}
                    {formatDateTime(log.createdAt)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {log.inventoryLocationName ??
                      "Inventory location unavailable"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
