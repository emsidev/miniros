import { CookingPot, Package } from "lucide-react";
import { subtractCents } from "@miniros/domain";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { listProducts } from "@/server/services/products";
import { CreateProductDialog } from "../_components/create-product-dialog";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await listProducts();
  const createAction = <CreateProductDialog />;

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
            <Card key={product.id} className="rounded-2xl py-5 shadow-none">
              <CardHeader className="flex-row items-start gap-3 px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted">
                  <Package className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate font-bold">
                    {product.name}
                  </CardTitle>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {product.sku ?? product.categoryName ?? "Uncategorized"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={product.status} />
                  <CreateProductDialog product={product} />
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
                  <Badge variant={product.isSellable ? "default" : "outline"}>
                    {product.isSellable
                      ? "Available in POS"
                      : "Hidden from POS"}
                  </Badge>
                  {product.requiresRecipeDeduction ? (
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
