import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { listInventoryItems } from "@/server/services/inventory-items";
import { CreateInventoryItemDialog } from "../../_components/create-inventory-item-dialog";
import { InventoryItemCatalog } from "../../_components/inventory-item-catalog";

export const dynamic = "force-dynamic";

export default async function InventoryItemsPage() {
  const items = await listInventoryItems();
  const createAction = <CreateInventoryItemDialog />;

  return (
    <>
      <PageHeader
        title="Inventory items"
        description="Define every ingredient, supply, package, or finished good your team tracks."
        action={items.length > 0 ? createAction : undefined}
      />

      {items.length === 0 ? (
        <EmptyState
          title="No inventory items yet"
          description="Add an ingredient, package, supply, equipment item, or finished product to get started."
          action={createAction}
        />
      ) : (
        <InventoryItemCatalog
          items={items.map(
            ({
              id,
              name,
              sku,
              itemType,
              unit,
              defaultUnitCostCents,
              trackStock,
              status,
            }) => ({
              id,
              name,
              sku,
              itemType,
              unit,
              defaultUnitCostCents,
              trackStock,
              status,
            }),
          )}
        />
      )}
    </>
  );
}
