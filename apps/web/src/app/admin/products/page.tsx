import { CookingPot, Package } from "lucide-react";
import { subtractCents } from "@miniros/domain";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { requireActiveBusiness } from "@/server/services/access";
import { listProductCategories } from "@/server/services/product-categories";
import { listInventoryItems } from "@/server/services/inventory-items";
import { listProducts } from "@/server/services/products";
import { CreateProductDialog } from "../_components/create-product-dialog";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [{ business }, products, categories, inventoryItems] =
    await Promise.all([
      requireActiveBusiness({ admin: true }),
      listProducts(),
      listProductCategories(),
      listInventoryItems(),
    ]);
  const finishedGoods = inventoryItems.filter(
    (item) =>
      item.itemType === "finished_good" &&
      item.trackStock &&
      item.status === "active",
  );
  const createAction = (
    <CreateProductDialog
      categories={categories}
      recipesEnabled={business.features.recipesEnabled}
      productionEnabled={business.features.productionEnabled}
      finishedGoods={finishedGoods}
    />
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Set the products your operators can sell and the costs used for profit."
        action={products.length > 0 ? createAction : undefined}
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add the first sellable product with its current price and unit cost."
          action={createAction}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id} className="rounded-xl py-5 shadow-none">
              <CardHeader className="flex-row items-start gap-3 px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                  <Package className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate font-bold">
                    {product.name}
                  </CardTitle>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {product.categoryName ?? "Uncategorized"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={product.status} />
                  <CreateProductDialog
                    product={product}
                    categories={categories}
                    recipesEnabled={business.features.recipesEnabled}
                    productionEnabled={business.features.productionEnabled}
                    finishedGoods={finishedGoods}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5">
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/60 p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Price</p>
                    <p className="mt-1 font-bold">
                      {formatMoney(product.priceCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost</p>
                    <p className="mt-1 font-bold">
                      {formatMoney(product.costCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className="mt-1 font-bold">
                      {formatMoney(
                        subtractCents(product.priceCents, product.costCents),
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{product.sku}</Badge>
                  <Badge variant="outline">
                    {product.categoryName ?? "Uncategorized"}
                  </Badge>
                  <Badge
                    variant={
                      product.costSource === "recipe" ? "default" : "outline"
                    }
                  >
                    {product.costSource === "recipe"
                      ? "Automatic cost"
                      : product.costSource === "override"
                        ? "Cost overridden"
                        : "Manual cost"}
                  </Badge>
                  <Badge variant={product.isSellable ? "default" : "outline"}>
                    {product.isSellable
                      ? "Available in POS"
                      : "Hidden from POS"}
                  </Badge>
                  {product.inventoryMode === "produced" ? (
                    <Badge variant="outline">
                      <CookingPot aria-hidden="true" />
                      Produced stock: {product.outputInventoryItemName}
                    </Badge>
                  ) : business.features.recipesEnabled &&
                    product.requiresRecipeDeduction ? (
                    <Badge variant="outline">
                      <CookingPot aria-hidden="true" />
                      Recipe deduction
                    </Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
