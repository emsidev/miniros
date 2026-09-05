import { AdminTable } from "@/components/shared/admin-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { calculateIngredientCostCents } from "@miniros/domain";
import { EmptyState } from "@/components/shared/feedback";
import { FeatureUnavailable } from "@/components/shared/feature-unavailable";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { listInventoryItems } from "@/server/services/inventory-items";
import { listProducts } from "@/server/services/products";
import { listRecipe } from "@/server/services/recipes";
import { ManageRecipeDialog } from "../../_components/manage-recipe-dialog";
import { requireActiveBusiness } from "@/server/services/access";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const { business } = await requireActiveBusiness({ admin: true });
  if (!business.features.recipesEnabled) {
    return (
      <FeatureUnavailable
        feature="Recipe"
        destination="/admin/settings"
        destinationLabel="Open settings"
      />
    );
  }

  const [products, inventoryItems] = await Promise.all([
    listProducts(),
    listInventoryItems(),
  ]);
  const recipeResults = await Promise.all(
    products.map((product) => listRecipe(product.id)),
  );
  const recipesByProduct = Object.fromEntries(
    recipeResults.map((recipe) => [
      recipe.product.id,
      {
        lines: recipe.lines.map((line) => ({
          id: line.id,
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          unit: line.unit,
          unitCostCents: line.unitCostCents,
        })),
        laborCostCents: recipe.product.laborCostCents,
        overheadCostCents: recipe.product.overheadCostCents,
      },
    ]),
  );
  const canManageRecipes = products.length > 0 && inventoryItems.length > 0;
  const manageAction = canManageRecipes ? (
    <ManageRecipeDialog
      products={products.map(({ id, name }) => ({ id, name }))}
      inventoryItems={inventoryItems.map(
        ({ id, name, unit, defaultUnitCostCents }) => ({
          id,
          name,
          unit,
          defaultUnitCostCents,
        }),
      )}
      recipes={recipesByProduct}
    />
  ) : undefined;

  return (
    <>
      <PageHeader
        title="Product recipes"
        description="Define inventory consumption and automatic standard unit costs."
        action={recipeResults.length > 0 ? manageAction : undefined}
      />

      {products.length === 0 ? (
        <EmptyState
          title="Add a product first"
          description="Recipes belong to products, so create at least one product before continuing."
          action={
            <Button asChild className="mt-2 h-11 rounded-xl">
              <Link href="/admin/products">Go to products</Link>
            </Button>
          }
        />
      ) : inventoryItems.length === 0 ? (
        <EmptyState
          title="Add inventory items first"
          description="Create the ingredients or supplies a product should consume."
          action={
            <Button asChild className="mt-2 h-11 rounded-xl">
              <Link href="/admin/inventory/items">Go to inventory items</Link>
            </Button>
          }
        />
      ) : (
        <AdminTable label="Product recipes">
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Product / recipe</TableHead>
              <TableHead scope="col">Cost source</TableHead>
              <TableHead scope="col" className="text-right">
                Ingredients
              </TableHead>
              <TableHead scope="col" className="text-right">
                Labor
              </TableHead>
              <TableHead scope="col" className="text-right">
                Overhead
              </TableHead>
              <TableHead scope="col" className="text-right">
                Unit cost
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipeResults.map((recipe) => (
              <TableRow key={recipe.product.id}>
                <TableCell className="min-w-72 max-w-md whitespace-normal break-words">
                  <p className="font-semibold">{recipe.product.name}</p>
                  {recipe.lines.length > 0 ? (
                    <details className="mt-1">
                      <summary className="min-h-11 cursor-pointer content-center text-muted-foreground underline-offset-4 hover:underline">
                        {recipe.lines.length === 1
                          ? "1 recipe line"
                          : `${recipe.lines.length} recipe lines`}
                        <span className="sr-only">
                          {" "}
                          for {recipe.product.name}
                        </span>
                      </summary>
                      <ul className="divide-y">
                        {recipe.lines.map((line) => (
                          <li
                            key={line.id}
                            className="flex items-start justify-between gap-4 py-2"
                          >
                            <span>{line.inventoryItemName}</span>
                            <span className="shrink-0 text-right">
                              <span className="block">
                                {line.quantity} {line.unit}
                              </span>
                              <span className="text-muted-foreground">
                                {formatMoney(
                                  calculateIngredientCostCents([
                                    {
                                      quantity: line.quantity,
                                      unitCostCents: line.unitCostCents,
                                    },
                                  ]),
                                )}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      This product does not deduct inventory yet.
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={recipe.lines.length > 0 ? "default" : "outline"}
                  >
                    {recipe.lines.length > 0
                      ? recipe.product.costSource === "override"
                        ? "Cost overridden"
                        : "Automatic cost"
                      : "Manual cost"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(recipe.product.ingredientCostCents)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(recipe.product.laborCostCents)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(recipe.product.overheadCostCents)}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatMoney(recipe.product.effectiveCostCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </AdminTable>
      )}
    </>
  );
}
