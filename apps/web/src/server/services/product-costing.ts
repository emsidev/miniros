import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  inventoryItems,
  productRecipeItems,
  products,
} from "@miniros/db/schema";
import {
  calculateIngredientCostCents,
  calculateStandardRecipeCost,
  resolveEffectiveProductCost,
  type RecipeCostSource,
} from "@miniros/domain";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";

export type ProductCostSource = RecipeCostSource;

export type ProductCostBreakdown = {
  ingredientCostCents: number;
  laborCostCents: number;
  overheadCostCents: number;
  calculatedCostCents: number;
  effectiveCostCents: number;
  manualCostCents: number;
  costOverrideCents: number | null;
  costSource: ProductCostSource;
  recipeLineCount: number;
};

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof requireDatabase>["transaction"]>[0]
>[0];

type ProductCostFields = {
  costCents: number;
  manualCostCents: number;
  laborCostCents: number;
  overheadCostCents: number;
  costOverrideCents: number | null;
};

type IngredientCostSummary = {
  ingredientCostCents: number;
  recipeLineCount: number;
};

export async function loadIngredientCostSummaries(
  tx: DatabaseTransaction,
  businessId: string,
  productIds?: readonly string[],
) {
  if (productIds?.length === 0) {
    return new Map<string, IngredientCostSummary>();
  }

  const rows = await tx
    .select({
      productId: productRecipeItems.productId,
      quantity: productRecipeItems.quantity,
      unitCostCents: inventoryItems.defaultUnitCostCents,
    })
    .from(productRecipeItems)
    .innerJoin(
      inventoryItems,
      and(
        eq(inventoryItems.id, productRecipeItems.inventoryItemId),
        eq(inventoryItems.businessId, productRecipeItems.businessId),
        isNull(inventoryItems.deletedAt),
        ne(inventoryItems.status, "deleted"),
      ),
    )
    .where(
      and(
        eq(productRecipeItems.businessId, businessId),
        isNull(productRecipeItems.deletedAt),
        ...(productIds
          ? [inArray(productRecipeItems.productId, productIds)]
          : []),
      ),
    );

  const linesByProduct = new Map<
    string,
    Array<{ quantity: string; unitCostCents: number }>
  >();
  for (const row of rows) {
    const lines = linesByProduct.get(row.productId) ?? [];
    lines.push({
      quantity: row.quantity,
      unitCostCents: row.unitCostCents,
    });
    linesByProduct.set(row.productId, lines);
  }

  return new Map(
    [...linesByProduct.entries()].map(([productId, lines]) => [
      productId,
      {
        ingredientCostCents: calculateIngredientCostCents(lines),
        recipeLineCount: lines.length,
      },
    ]),
  );
}

export function buildProductCostBreakdown(
  product: ProductCostFields,
  ingredientSummary: IngredientCostSummary | undefined,
  recipesEnabled: boolean,
): ProductCostBreakdown {
  const ingredientCostCents = ingredientSummary?.ingredientCostCents ?? 0;
  const recipeLineCount = ingredientSummary?.recipeLineCount ?? 0;
  const calculatedCostCents = calculateStandardRecipeCost({
    lines: [{ quantity: 1, unitCostCents: ingredientCostCents }],
    laborCostCents: product.laborCostCents,
    overheadCostCents: product.overheadCostCents,
  }).totalCostCents;
  const effective = resolveEffectiveProductCost({
    recipesEnabled,
    recipeLineCount,
    manualCostCents: product.manualCostCents,
    calculatedCostCents,
    costOverrideCents: product.costOverrideCents,
  });

  return {
    ingredientCostCents,
    laborCostCents: product.laborCostCents,
    overheadCostCents: product.overheadCostCents,
    calculatedCostCents,
    effectiveCostCents: product.costCents,
    manualCostCents: product.manualCostCents,
    costOverrideCents: product.costOverrideCents,
    costSource: effective.costSource,
    recipeLineCount,
  };
}

export async function loadProductCostBreakdowns(
  tx: DatabaseTransaction,
  input: {
    businessId: string;
    recipesEnabled: boolean;
    productIds?: readonly string[];
  },
) {
  if (input.productIds?.length === 0) {
    return new Map<string, ProductCostBreakdown>();
  }
  const productRows = await tx
    .select({
      id: products.id,
      costCents: products.costCents,
      manualCostCents: products.manualCostCents,
      laborCostCents: products.laborCostCents,
      overheadCostCents: products.overheadCostCents,
      costOverrideCents: products.costOverrideCents,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, input.businessId),
        isNull(products.deletedAt),
        ne(products.status, "deleted"),
        ...(input.productIds ? [inArray(products.id, input.productIds)] : []),
      ),
    );
  const summaries = await loadIngredientCostSummaries(
    tx,
    input.businessId,
    productRows.map((product) => product.id),
  );
  return new Map(
    productRows.map((product) => [
      product.id,
      buildProductCostBreakdown(
        product,
        summaries.get(product.id),
        input.recipesEnabled,
      ),
    ]),
  );
}

export async function recalculateProductCosts(
  tx: DatabaseTransaction,
  input: {
    businessId: string;
    recipesEnabled: boolean;
    previousRecipesEnabled?: boolean;
    productIds?: readonly string[];
    trigger: string;
    actorUserId: string;
    actorEmployeeId: string | null;
    previousBreakdowns?: ReadonlyMap<string, ProductCostBreakdown>;
  },
) {
  if (input.productIds?.length === 0) return [];

  const productRows = await tx
    .select({
      id: products.id,
      name: products.name,
      costCents: products.costCents,
      manualCostCents: products.manualCostCents,
      laborCostCents: products.laborCostCents,
      overheadCostCents: products.overheadCostCents,
      costOverrideCents: products.costOverrideCents,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, input.businessId),
        isNull(products.deletedAt),
        ne(products.status, "deleted"),
        ...(input.productIds ? [inArray(products.id, input.productIds)] : []),
      ),
    );
  const summaries = await loadIngredientCostSummaries(
    tx,
    input.businessId,
    productRows.map((product) => product.id),
  );
  const recalculated = [];

  for (const product of productRows) {
    const currentCalculation = buildProductCostBreakdown(
      product,
      summaries.get(product.id),
      input.recipesEnabled,
    );
    const before =
      input.previousBreakdowns?.get(product.id) ??
      buildProductCostBreakdown(
        product,
        summaries.get(product.id),
        input.previousRecipesEnabled ?? input.recipesEnabled,
      );
    const automatic =
      input.recipesEnabled &&
      (summaries.get(product.id)?.recipeLineCount ?? 0) > 0;
    const nextCostCents = automatic
      ? currentCalculation.calculatedCostCents
      : product.manualCostCents;
    const shouldRecord =
      before.recipeLineCount > 0 ||
      product.costOverrideCents !== null ||
      product.costCents !== nextCostCents;
    if (!shouldRecord) continue;

    await tx
      .update(products)
      .set({
        costCents: nextCostCents,
        costOverrideCents: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, product.id),
          eq(products.businessId, input.businessId),
        ),
      );

    const after = {
      ...currentCalculation,
      effectiveCostCents: nextCostCents,
      costOverrideCents: null,
      costSource: automatic ? ("recipe" as const) : ("manual" as const),
    };
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: input.businessId,
      actorUserId: input.actorUserId,
      actorEmployeeId: input.actorEmployeeId,
      action: "product.cost_recalculated",
      entityType: "product",
      entityId: product.id,
      metadata: {
        productName: product.name,
        trigger: input.trigger,
        before,
        after,
        clearedOverride: product.costOverrideCents !== null,
      },
    });
    recalculated.push({ productId: product.id, before, after });
  }

  return recalculated;
}
