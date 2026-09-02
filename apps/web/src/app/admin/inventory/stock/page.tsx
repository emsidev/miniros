import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { formatDateTime } from "@/lib/format";
import { listStockWorkspace } from "@/server/services/stock-operations";
import {
  CentralLocationForm,
  StockMovementForm,
} from "../../_components/stock-movement-form";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const workspace = await listStockWorkspace();
  const locationNames = new Map(
    workspace.locations.map((location) => [location.id, location.name]),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stock movements"
        description="Receive supplies and move stock between inventory locations while keeping the ledger balanced."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <DataCard>
          <SectionHeader
            title="Record movement"
            description="Every movement creates a ledger event and updates the balance in one transaction."
          />
          <StockMovementForm
            locations={workspace.locations}
            items={workspace.items}
          />
        </DataCard>
        <DataCard>
          <SectionHeader
            title="Inventory locations"
            description="Central storage and active shift inventory locations available for movement."
          />
          {workspace.locations.length === 0 ? (
            <EmptyState
              title="No stock locations"
              description="Create a central location before receiving stock."
            />
          ) : (
            <div className="space-y-2">
              {workspace.locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <span className="font-semibold">{location.name}</span>
                  <StatusBadge status={location.locationType} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 border-t pt-5">
            <CentralLocationForm />
          </div>
        </DataCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <DataCard>
          <SectionHeader title="Recent receiving" />
          {workspace.receivings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stock receipts yet.
            </p>
          ) : (
            <div className="space-y-3">
              {workspace.receivings.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {record.referenceNumber ?? "Stock receipt"}
                    </p>
                    <p className="text-muted-foreground">
                      {locationNames.get(record.locationId) ??
                        "Inventory location"}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {formatDateTime(record.receivedAt)}
                  </time>
                </div>
              ))}
            </div>
          )}
        </DataCard>
        <DataCard>
          <SectionHeader title="Recent transfers" />
          {workspace.transfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stock transfers yet.
            </p>
          ) : (
            <div className="space-y-3">
              {workspace.transfers.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {locationNames.get(record.fromLocationId) ?? "Unknown"} →{" "}
                      {locationNames.get(record.toLocationId) ?? "Unknown"}
                    </p>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {formatDateTime(record.transferredAt)}
                  </time>
                </div>
              ))}
            </div>
          )}
        </DataCard>
      </div>
    </div>
  );
}
