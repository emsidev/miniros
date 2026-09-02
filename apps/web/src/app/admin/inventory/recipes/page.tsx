import Link from "next/link";
import { CookingPot } from "lucide-react";
import { calculateIngredientCostCents } from "@miniros/domain";
import { EmptyState } from "@/components/shared/feedback";
import { FeatureUnavailable } from "@/components/shared/feature-unavailable";
import { PageHeader } from "@/components/shared/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="grid gap-4 lg:grid-cols-2">
          {recipeResults.map((recipe) => (
            <Card
              key={recipe.product.id}
              className="rounded-xl py-5 shadow-none"
            >
              <CardHeader className="flex-row items-start gap-3 px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                  <CookingPot className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate font-bold">
                    {recipe.product.name}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {recipe.lines.length === 1
                      ? "1 recipe line"
                      : `${recipe.lines.length} recipe lines`}
                  </p>
                </div>
                <Badge
                  variant={recipe.lines.length > 0 ? "default" : "outline"}
                >
                  {recipe.lines.length > 0
                    ? recipe.product.costSource === "override"
                      ? "Cost overridden"
                      : "Automatic cost"
                    : "Manual cost"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 px-5">
                {recipe.lines.length > 0 ? (
                  <ul className="divide-y rounded-xl border">
                    {recipe.lines.map((line) => (
                      <li
                        key={line.id}
                        className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm"
                      >
                        <span className="truncate">
                          {line.inventoryItemName}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-semibold">
                            {line.quantity} {line.unit}
                          </span>
                          <span className="text-xs text-muted-foreground">
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
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                    This product does not deduct inventory yet.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Ingredients</p>
                    <p className="font-bold">
                      {formatMoney(recipe.product.ingredientCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Labor</p>
                    <p className="font-bold">
                      {formatMoney(recipe.product.laborCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Overhead</p>
                    <p className="font-bold">
                      {formatMoney(recipe.product.overheadCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Unit cost</p>
                    <p className="font-bold">
                      {formatMoney(recipe.product.effectiveCostCents)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
