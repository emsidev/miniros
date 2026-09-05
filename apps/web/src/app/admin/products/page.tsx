import { AdminTable } from "@/components/shared/admin-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { subtractCents } from "@miniros/domain";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
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
        <AdminTable label="Products">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Product / SKU</TableHead>
              <TableHead scope="col">Category</TableHead>
              <TableHead scope="col" className="text-right">
                Price
              </TableHead>
              <TableHead scope="col" className="text-right">
                Cost
              </TableHead>
              <TableHead scope="col" className="text-right">
                Margin
              </TableHead>
              <TableHead scope="col">Cost source</TableHead>
              <TableHead scope="col">Availability / stock</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="min-w-48 max-w-72 whitespace-normal break-words">
                  <p className="font-semibold">{product.name}</p>
                  <p className="mt-1 text-muted-foreground">{product.sku}</p>
                </TableCell>
                <TableCell className="min-w-36 max-w-48 whitespace-normal break-words">
                  {product.categoryName ?? "Uncategorized"}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(product.priceCents)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(product.costCents)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(
                    subtractCents(product.priceCents, product.costCents),
                  )}
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell className="min-w-48 max-w-64 whitespace-normal break-words">
                  <Badge variant={product.isSellable ? "default" : "outline"}>
                    {product.isSellable
                      ? "Available in POS"
                      : "Hidden from POS"}
                  </Badge>
                  {product.inventoryMode === "produced" ? (
                    <p className="mt-2 text-muted-foreground">
                      Produced stock: {product.outputInventoryItemName}
                    </p>
                  ) : business.features.recipesEnabled &&
                    product.requiresRecipeDeduction ? (
                    <p className="mt-2 text-muted-foreground">
                      Recipe deduction
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <StatusBadge status={product.status} />
                </TableCell>
                <TableCell className="text-right">
                  <CreateProductDialog
                    product={product}
                    categories={categories}
                    recipesEnabled={business.features.recipesEnabled}
                    productionEnabled={business.features.productionEnabled}
                    finishedGoods={finishedGoods}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </AdminTable>
      )}
    </>
  );
}
