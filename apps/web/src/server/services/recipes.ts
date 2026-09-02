import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { assertNonNegativeCents } from "@miniros/domain";
import {
  auditLogs,
  inventoryItems,
  productRecipeItems,
  products,
} from "@miniros/db/schema";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import {
  buildProductCostBreakdown,
  loadIngredientCostSummaries,
  loadProductCostBreakdowns,
  recalculateProductCosts,
} from "./product-costing";

export type RecipeLineInput = {
  inventoryItemId: string;
  quantity: string;
  unit: string;
};

const QUANTITY_PATTERN = /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/;

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof requireDatabase>["transaction"]>[0]
>[0];

function assertRecipeLines(lines: RecipeLineInput[]) {
  const itemIds = new Set<string>();
  for (const line of lines) {
    const quantity = line.quantity.trim();
    if (!QUANTITY_PATTERN.test(quantity) || /^0(?:\.0{1,3})?$/.test(quantity)) {
      throw new AccessError(
        "Recipe quantities must be positive decimal strings with at most three decimal places.",
      );
    }
    if (itemIds.has(line.inventoryItemId)) {
      throw new AccessError("A recipe cannot contain the same item twice.");
    }
    itemIds.add(line.inventoryItemId);
  }
}

async function findScopedProduct(
  database: DatabaseTransaction,
  businessId: string,
  productId: string,
) {
  const [product] = await database
    .select({
      id: products.id,
      name: products.name,
      requiresRecipeDeduction: products.requiresRecipeDeduction,
      costCents: products.costCents,
      manualCostCents: products.manualCostCents,
      laborCostCents: products.laborCostCents,
      overheadCostCents: products.overheadCostCents,
      costOverrideCents: products.costOverrideCents,
    })
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.businessId, businessId),
        isNull(products.deletedAt),
        ne(products.status, "deleted"),
      ),
    )
    .limit(1);

  if (!product) {
    throw new AccessError("Product not found.");
  }
  return product;
}

export async function listRecipe(productId: string) {
  const { business } = await requireActiveBusiness({
    admin: true,
    feature: "recipes",
  });
  const database = requireDatabase();
  return database.transaction(async (tx) => {
    const product = await findScopedProduct(tx, business.id, productId);
    const rows = await tx
      .select({
        id: productRecipeItems.id,
        inventoryItemId: productRecipeItems.inventoryItemId,
        inventoryItemName: inventoryItems.name,
        quantity: productRecipeItems.quantity,
        unit: productRecipeItems.unit,
        unitCostCents: inventoryItems.defaultUnitCostCents,
        createdAt: productRecipeItems.createdAt,
        updatedAt: productRecipeItems.updatedAt,
      })
      .from(productRecipeItems)
      .innerJoin(
        inventoryItems,
        and(
          eq(productRecipeItems.inventoryItemId, inventoryItems.id),
          eq(inventoryItems.businessId, business.id),
          isNull(inventoryItems.deletedAt),
          ne(inventoryItems.status, "deleted"),
        ),
      )
      .where(
        and(
          eq(productRecipeItems.businessId, business.id),
          eq(productRecipeItems.productId, productId),
          isNull(productRecipeItems.deletedAt),
        ),
      )
      .orderBy(asc(inventoryItems.name));
    const summaries = await loadIngredientCostSummaries(tx, business.id, [
      productId,
    ]);

    return {
      product: {
        ...product,
        ...buildProductCostBreakdown(
          product,
          summaries.get(productId),
          business.features.recipesEnabled,
        ),
      },
      lines: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  });
}

export async function replaceRecipe(
  productId: string,
  lines: RecipeLineInput[],
  costs: { laborCostCents: number; overheadCostCents: number },
) {
  const access = await requireActiveBusiness({
    admin: true,
    feature: "recipes",
  });
  const database = requireDatabase();
  assertRecipeLines(lines);
  assertNonNegativeCents(costs.laborCostCents, "laborCostCents");
  assertNonNegativeCents(costs.overheadCostCents, "overheadCostCents");

  return database.transaction(async (tx) => {
    const [product] = await tx
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
          eq(products.id, productId),
          eq(products.businessId, access.business.id),
          isNull(products.deletedAt),
          ne(products.status, "deleted"),
        ),
      )
      .limit(1);

    if (!product) {
      throw new AccessError("Product not found.");
    }
    const previousBreakdowns = await loadProductCostBreakdowns(tx, {
      businessId: access.business.id,
      recipesEnabled: access.business.features.recipesEnabled,
      productIds: [productId],
    });

    const requestedIds = lines.map((line) => line.inventoryItemId);
    const scopedItems = requestedIds.length
      ? await tx
          .select({
            id: inventoryItems.id,
            name: inventoryItems.name,
            unit: inventoryItems.unit,
          })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.businessId, access.business.id),
              inArray(inventoryItems.id, requestedIds),
              isNull(inventoryItems.deletedAt),
              ne(inventoryItems.status, "deleted"),
            ),
          )
      : [];

    if (scopedItems.length !== requestedIds.length) {
      throw new AccessError("One or more recipe items are unavailable.");
    }

    const scopedItemById = new Map(scopedItems.map((item) => [item.id, item]));
    for (const line of lines) {
      const item = scopedItemById.get(line.inventoryItemId);
      if (!item || item.unit !== line.unit.trim()) {
        throw new AccessError(
          `Recipe unit for ${item?.name ?? "an item"} must be ${item?.unit ?? "its inventory unit"}.`,
        );
      }
    }

    const existingLines = await tx
      .select()
      .from(productRecipeItems)
      .where(
        and(
          eq(productRecipeItems.businessId, access.business.id),
          eq(productRecipeItems.productId, productId),
        ),
      );
    const existingByItem = new Map(
      existingLines.map((line) => [line.inventoryItemId, line]),
    );
    const requestedIdSet = new Set(requestedIds);
    const now = new Date();

    for (const existing of existingLines) {
      if (
        !requestedIdSet.has(existing.inventoryItemId) &&
        !existing.deletedAt
      ) {
        await tx
          .update(productRecipeItems)
          .set({ deletedAt: now, updatedAt: now })
          .where(
            and(
              eq(productRecipeItems.id, existing.id),
              eq(productRecipeItems.businessId, access.business.id),
            ),
          );
      }
    }

    const newLines: (typeof productRecipeItems.$inferInsert)[] = [];
    for (const line of lines) {
      const existing = existingByItem.get(line.inventoryItemId);
      if (existing) {
        await tx
          .update(productRecipeItems)
          .set({
            quantity: line.quantity.trim(),
            unit: line.unit.trim(),
            deletedAt: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(productRecipeItems.id, existing.id),
              eq(productRecipeItems.businessId, access.business.id),
            ),
          );
      } else {
        newLines.push({
          id: randomUUID(),
          businessId: access.business.id,
          productId,
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity.trim(),
          unit: line.unit.trim(),
        });
      }
    }

    if (newLines.length) {
      await tx.insert(productRecipeItems).values(newLines);
    }

    await tx
      .update(products)
      .set({
        requiresRecipeDeduction: lines.length > 0,
        laborCostCents: costs.laborCostCents,
        overheadCostCents: costs.overheadCostCents,
        updatedAt: now,
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.businessId, access.business.id),
        ),
      );

    const [costRecalculation] = await recalculateProductCosts(tx, {
      businessId: access.business.id,
      recipesEnabled: access.business.features.recipesEnabled,
      productIds: [productId],
      trigger: "recipe_saved",
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      previousBreakdowns,
    });

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "product_recipe.replaced",
      entityType: "product",
      entityId: productId,
      metadata: {
        productName: product.name,
        lineCount: lines.length,
        inventoryItemIds: requestedIds,
        laborCostCents: costs.laborCostCents,
        overheadCostCents: costs.overheadCostCents,
        costBefore: costRecalculation?.before ?? null,
        costAfter: costRecalculation?.after ?? null,
      },
    });

    const savedLines = await tx
      .select({
        id: productRecipeItems.id,
        inventoryItemId: productRecipeItems.inventoryItemId,
        inventoryItemName: inventoryItems.name,
        quantity: productRecipeItems.quantity,
        unit: productRecipeItems.unit,
        unitCostCents: inventoryItems.defaultUnitCostCents,
        createdAt: productRecipeItems.createdAt,
        updatedAt: productRecipeItems.updatedAt,
      })
      .from(productRecipeItems)
      .innerJoin(
        inventoryItems,
        and(
          eq(productRecipeItems.inventoryItemId, inventoryItems.id),
          eq(inventoryItems.businessId, access.business.id),
        ),
      )
      .where(
        and(
          eq(productRecipeItems.businessId, access.business.id),
          eq(productRecipeItems.productId, productId),
          isNull(productRecipeItems.deletedAt),
        ),
      )
      .orderBy(asc(inventoryItems.name));

    const summaries = await loadIngredientCostSummaries(
      tx,
      access.business.id,
      [productId],
    );
    const refreshedProduct = {
      ...product,
      costCents:
        costRecalculation?.after.effectiveCostCents ?? product.costCents,
      laborCostCents: costs.laborCostCents,
      overheadCostCents: costs.overheadCostCents,
      costOverrideCents: null,
    };

    return {
      product: {
        ...refreshedProduct,
        requiresRecipeDeduction: lines.length > 0,
        ...buildProductCostBreakdown(
          refreshedProduct,
          summaries.get(productId),
          access.business.features.recipesEnabled,
        ),
      },
      lines: savedLines.map((line) => ({
        ...line,
        createdAt: line.createdAt.toISOString(),
        updatedAt: line.updatedAt.toISOString(),
      })),
    };
  });
}
