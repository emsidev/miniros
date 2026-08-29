import { EmptyState } from "@/components/shared/feedback";
import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { getProductionWorkspace } from "@/server/services/operator-workspaces";
import { ProductionForm } from "./production-form";

export const dynamic = "force-dynamic";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const { shift } = await searchParams;
  const workspace = await getProductionWorkspace(shift);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production"
        description={`${workspace.shift.locationName} · Recipe inputs are deducted automatically.`}
      />
      {workspace.products.length === 0 ? (
        <EmptyState
          title="No recipes available"
          description="Ask an admin to build a product recipe before logging production."
        />
      ) : (
        <ProductionForm
          shiftId={workspace.shift.id}
          products={workspace.products}
        />
      )}
      <section>
        <SectionHeader title="Recent production" />
        {workspace.recentLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No production logged this shift.
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
              </DataCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
