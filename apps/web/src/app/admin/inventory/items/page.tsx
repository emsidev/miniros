import { Box, ScanBarcode } from "lucide-react";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { listInventoryItems } from "@/server/services/inventory-items";
import { CreateInventoryItemDialog } from "../../_components/create-inventory-item-dialog";
import { humanize } from "../../_components/form-utils";

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
          description="Add an item with its stock unit and normal unit cost before building recipes."
          action={createAction}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="rounded-2xl py-5 shadow-none">
              <CardHeader className="flex-row items-start gap-3 px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted">
                  <Box className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate font-bold">
                    {item.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {humanize(item.itemType)} · {item.unit}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={item.status} />
                  <CreateInventoryItemDialog item={item} />
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2 px-5">
                <Badge variant="outline">
                  {formatMoney(item.defaultUnitCostCents)} / {item.unit}
                </Badge>
                <Badge variant={item.trackStock ? "default" : "outline"}>
                  {item.trackStock ? "Stock tracked" : "Not tracked"}
                </Badge>
                {item.sku ? (
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ScanBarcode className="size-3.5" aria-hidden="true" />
                    {item.sku}
                  </span>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
