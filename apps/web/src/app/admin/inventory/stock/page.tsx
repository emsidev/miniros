import { StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { listStockWorkspace } from "@/server/services/stock-operations";
import { StockMovementForm } from "../../_components/stock-movement-form";

export const dynamic = "force-dynamic";
export default async function StockPage() {
  const workspace = await listStockWorkspace();
  const locationNames = new Map(
    workspace.locations.map((location) => [location.id, location.name]),
  );
  return (
    <div className="inventory-workspace space-y-5">
      <PageHeader
        title="Stock movements"
        description="Receive supplies and transfer stock between locations."
      />
      <StockMovementForm
        businessId={workspace.businessId}
        locations={workspace.locations}
        items={workspace.items}
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Recent receiving</h2>
          {!workspace.receivings.length ? (
            <p className="text-sm text-muted-foreground">
              No stock receipts yet. Use Receive stock to record your first
              delivery.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {workspace.receivings.map((record) => (
                <li key={record.id} className="space-y-3 p-4">
                  <div>
                    <p className="break-words font-semibold">
                      {record.referenceNumber ?? "Stock receipt"}
                    </p>
                    <p className="break-words text-sm text-muted-foreground">
                      {locationNames.get(record.locationId) ??
                        "Archived inventory location"}
                    </p>
                    <time className="text-xs text-muted-foreground">
                      {formatDateTime(record.receivedAt)}
                    </time>
                  </div>
                  <MovementLines lines={record.lines} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Recent transfers</h2>
          {!workspace.transfers.length ? (
            <p className="text-sm text-muted-foreground">
              No transfers yet. Use Transfer stock to move items between
              locations.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {workspace.transfers.map((record) => (
                <li key={record.id} className="space-y-3 p-4">
                  <div>
                    <p className="break-words font-semibold">
                      {locationNames.get(record.fromLocationId) ??
                        "Archived location"}{" "}
                      →{" "}
                      {locationNames.get(record.toLocationId) ??
                        "Archived location"}
                    </p>
                    <time className="text-xs text-muted-foreground">
                      {formatDateTime(record.transferredAt)}
                    </time>
                  </div>
                  <MovementLines lines={record.lines} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="space-y-3 border-t pt-5">
        <h2 className="text-lg font-bold">Inventory locations</h2>
        {!workspace.locations.length ? (
          <p className="text-sm text-muted-foreground">
            Use Add location to create central storage before receiving stock.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {workspace.locations.map((location) => (
              <li
                key={location.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="min-w-0 break-words text-sm font-semibold">
                  {location.name}
                </span>
                <StatusBadge status={location.locationType} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
function MovementLines({
  lines,
}: {
  lines: readonly {
    id: string;
    itemName: string | null;
    quantity: string;
    unit: string;
  }[];
}) {
  return (
    <ul className="space-y-2 border-t pt-3 text-sm">
      {lines.map((line) => (
        <li key={line.id} className="flex justify-between gap-4">
          <span className="min-w-0 break-words">
            {line.itemName ?? "Archived inventory item"}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">
            {formatQuantity(line.quantity)} {line.unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
