import {
  DataCard,
  PageHeader,
  SectionHeader,
} from "@/components/shared/layout";
import { formatDateTime, formatQuantity } from "@/lib/format";
import { getInventoryWorkspace } from "@/server/services/operator-workspaces";
import {
  isProductionOnlyEmployee,
  requireActiveBusiness,
} from "@/server/services/access";
import { RequestForms } from "./request-forms";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const { employee } = await requireActiveBusiness();
  if (isProductionOnlyEmployee(employee)) redirect("/production");
  const { shift } = await searchParams;
  const workspace = await getInventoryWorkspace(shift);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Shift inventory"
        description={`${workspace.shift.locationName} · Opening count, estimated stock, and adjustment requests.`}
      />
      <section>
        <SectionHeader title="Current estimated stock" />
        <div className="grid gap-3 sm:grid-cols-2">
          {workspace.balances.map((balance) => (
            <DataCard key={balance.inventoryItemId}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-bold">{balance.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Opened at {formatQuantity(balance.openingQuantity)}{" "}
                    {balance.unit}
                  </p>
                </div>
                <p className="text-xl font-extrabold">
                  {formatQuantity(balance.quantityOnHand)}{" "}
                  <span className="text-xs font-medium text-muted-foreground">
                    {balance.unit}
                  </span>
                </p>
              </div>
            </DataCard>
          ))}
        </div>
      </section>
      <RequestForms
        shiftId={workspace.shift.id}
        items={workspace.balances}
        approvalsEnabled={workspace.approvalsEnabled}
      />
      <section>
        <SectionHeader title="Recent inventory events" />
        <div className="space-y-2">
          {workspace.recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No inventory events yet.
            </p>
          ) : (
            workspace.recentEvents.map((event) => (
              <DataCard
                key={`${event.id}-${event.itemName}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold">{event.itemName}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {event.eventType.replaceAll("_", " ")} ·{" "}
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
                <p className="font-bold">
                  {Number(event.quantityDelta) > 0 ? "+" : ""}
                  {formatQuantity(event.quantityDelta)} {event.unit}
                </p>
              </DataCard>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
import { redirect } from "next/navigation";
