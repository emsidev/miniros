import { requireDatabase } from "@miniros/db";
import {
  inventoryBalances,
  inventoryEventLines,
  inventoryEvents,
  inventoryItems,
  inventoryLocations,
  productCategories,
  productRecipeItems,
  productProductionOutputs,
  productionLogs,
  promoRules,
  products,
  saleItems,
  sales,
  shiftInventoryCounts,
} from "@miniros/db/schema";
import { calculatePosAvailableQuantity } from "@miniros/domain";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import { resolveOperationalShift } from "./operator-workspace-core";

export async function getStartShiftWorkspace(shiftId: string) {
  const { access, shift } = await resolveOperationalShift({
    permission: "pos",
    shiftId,
    statuses: ["scheduled"],
  });
  const items = await requireDatabase()
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      unit: inventoryItems.unit,
    })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.businessId, access.business.id),
        eq(inventoryItems.status, "active"),
        eq(inventoryItems.trackStock, true),
        isNull(inventoryItems.deletedAt),
      ),
    )
    .orderBy(asc(inventoryItems.name));

  return { shift, items };
}

export async function getPosWorkspace(shiftId?: string) {
  const { access, shift } = await resolveOperationalShift({
    permission: "pos",
    shiftId,
    statuses: ["active"],
  });
  const database = requireDatabase();
  const now = new Date();
  const promosPromise = access.business.features.promosEnabled
    ? database
        .select({
          id: promoRules.id,
          name: promoRules.name,
          discountType: promoRules.discountType,
          discountValue: promoRules.discountValue,
        })
        .from(promoRules)
        .where(
          and(
            eq(promoRules.businessId, access.business.id),
            eq(promoRules.status, "active"),
            or(isNull(promoRules.startsAt), lte(promoRules.startsAt, now)),
            or(isNull(promoRules.endsAt), gte(promoRules.endsAt, now)),
          ),
        )
        .orderBy(asc(promoRules.name))
    : Promise.resolve([]);
  const [catalog, recentSales, promos] = await Promise.all([
    database
      .select({
        id: products.id,
        name: products.name,
        categoryName: productCategories.name,
        priceCents: products.priceCents,
        requiresRecipeDeduction: products.requiresRecipeDeduction,
        producedInventoryItemId: productProductionOutputs.inventoryItemId,
      })
      .from(products)
      .leftJoin(
        productCategories,
        and(
          eq(productCategories.id, products.categoryId),
          eq(productCategories.businessId, products.businessId),
          isNull(productCategories.deletedAt),
        ),
      )
      .leftJoin(
        productProductionOutputs,
        and(
          eq(productProductionOutputs.productId, products.id),
          eq(productProductionOutputs.businessId, products.businessId),
        ),
      )
      .where(
        and(
          eq(products.businessId, access.business.id),
          eq(products.status, "active"),
          eq(products.isSellable, true),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(productCategories.name), asc(products.name)),
    database
      .select({
        id: sales.id,
        saleNumber: sales.saleNumber,
        totalCents: sales.totalCents,
        soldAt: sales.soldAt,
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, access.business.id),
          eq(sales.shiftId, shift.id),
          eq(sales.status, "completed"),
        ),
      )
      .orderBy(desc(sales.soldAt))
      .limit(5),
    promosPromise,
  ]);

  const catalogIds = catalog.map((product) => product.id);
  const saleScope = and(
    eq(sales.businessId, access.business.id),
    eq(sales.shiftId, shift.id),
    eq(sales.status, "completed"),
  );
  const [recipeRows, balanceRows, saleSummaryRows, itemSummaryRows] =
    await Promise.all([
      access.business.features.recipesEnabled && catalogIds.length > 0
        ? database
            .select({
              productId: productRecipeItems.productId,
              inventoryItemId: productRecipeItems.inventoryItemId,
              quantityPerUnit: productRecipeItems.quantity,
            })
            .from(productRecipeItems)
            .where(
              and(
                eq(productRecipeItems.businessId, access.business.id),
                inArray(productRecipeItems.productId, catalogIds),
                isNull(productRecipeItems.deletedAt),
              ),
            )
        : Promise.resolve([]),
      shift.inventoryLocationId
        ? database
            .select({
              inventoryItemId: inventoryBalances.inventoryItemId,
              quantity: inventoryBalances.quantityOnHand,
            })
            .from(inventoryBalances)
            .where(
              and(
                eq(inventoryBalances.businessId, access.business.id),
                eq(
                  inventoryBalances.inventoryLocationId,
                  shift.inventoryLocationId,
                ),
              ),
            )
        : Promise.resolve([]),
      database
        .select({
          saleCount: sql<number>`count(*)::int`,
          salesCents: sql<string>`coalesce(sum(${sales.totalCents}), 0)`,
        })
        .from(sales)
        .where(saleScope),
      database
        .select({
          itemCount: sql<string>`coalesce(sum(${saleItems.quantity}), 0)`,
        })
        .from(saleItems)
        .innerJoin(
          sales,
          and(
            eq(sales.id, saleItems.saleId),
            eq(sales.businessId, saleItems.businessId),
          ),
        )
        .where(saleScope),
    ]);

  const recipeRequirements = new Map<
    string,
    { inventoryItemId: string; quantityPerUnit: string }[]
  >();
  recipeRows.forEach((row) => {
    const requirements = recipeRequirements.get(row.productId) ?? [];
    requirements.push({
      inventoryItemId: row.inventoryItemId,
      quantityPerUnit: row.quantityPerUnit,
    });
    recipeRequirements.set(row.productId, requirements);
  });

  const productsWithStock = catalog.map((product) => {
    const recipeTracked =
      access.business.features.recipesEnabled &&
      product.requiresRecipeDeduction &&
      !product.producedInventoryItemId;
    return {
      id: product.id,
      name: product.name,
      categoryName: product.categoryName,
      priceCents: product.priceCents,
      requiresRecipeDeduction: recipeTracked,
      stockTracked: Boolean(product.producedInventoryItemId || recipeTracked),
      stockRequirements: product.producedInventoryItemId
        ? [
            {
              inventoryItemId: product.producedInventoryItemId,
              quantityPerUnit: "1.000",
            },
          ]
        : (recipeRequirements.get(product.id) ?? []),
    };
  });

  const stockProducts = productsWithStock.map((product) => ({
    productId: product.id,
    stockTracked: product.stockTracked,
    requirements: product.stockRequirements,
  }));
  const productsWithAvailability = productsWithStock.map((product) => ({
    ...product,
    availableQuantity: calculatePosAvailableQuantity({
      productId: product.id,
      products: stockProducts,
      balances: balanceRows,
      cart: [],
    }),
  }));

  const saleSummary = saleSummaryRows[0];
  const itemSummary = itemSummaryRows[0];

  return {
    shift,
    shiftSummary: {
      saleCount: saleSummary?.saleCount ?? 0,
      itemCount: Number(itemSummary?.itemCount ?? 0),
      salesCents: Number(saleSummary?.salesCents ?? 0),
    },
    inventoryBalances: balanceRows,
    products: productsWithAvailability,
    recentSales,
    promosEnabled: access.business.features.promosEnabled,
    promos: promos.map((promo) => ({
      ...promo,
      discountValue: Number(promo.discountValue),
    })),
  };
}

export async function getProductionWorkspace() {
  const access = await requireActiveBusiness({
    feature: "production",
    employeePermission: "production",
  });
  const database = requireDatabase();
  const [centralLocations, recipeProducts, recentLogs] = await Promise.all([
    database
      .select({ id: inventoryLocations.id, name: inventoryLocations.name })
      .from(inventoryLocations)
      .where(
        and(
          eq(inventoryLocations.businessId, access.business.id),
          eq(inventoryLocations.locationType, "central"),
          eq(inventoryLocations.status, "active"),
          isNull(inventoryLocations.deletedAt),
        ),
      )
      .orderBy(asc(inventoryLocations.name)),
    database
      .selectDistinct({
        id: products.id,
        name: products.name,
        unit: inventoryItems.unit,
      })
      .from(products)
      .innerJoin(
        productRecipeItems,
        and(
          eq(productRecipeItems.productId, products.id),
          eq(productRecipeItems.businessId, products.businessId),
          isNull(productRecipeItems.deletedAt),
        ),
      )
      .innerJoin(
        productProductionOutputs,
        and(
          eq(productProductionOutputs.productId, products.id),
          eq(productProductionOutputs.businessId, products.businessId),
        ),
      )
      .innerJoin(
        inventoryItems,
        and(
          eq(inventoryItems.id, productProductionOutputs.inventoryItemId),
          eq(inventoryItems.businessId, products.businessId),
          eq(inventoryItems.itemType, "finished_good"),
          eq(inventoryItems.trackStock, true),
          eq(inventoryItems.status, "active"),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .where(
        and(
          eq(products.businessId, access.business.id),
          eq(products.status, "active"),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(products.name)),
    database
      .select({
        id: productionLogs.id,
        productName: products.name,
        quantityProduced: productionLogs.quantityProduced,
        unit: productionLogs.unit,
        inventoryLocationName: inventoryLocations.name,
        createdAt: productionLogs.createdAt,
      })
      .from(productionLogs)
      .innerJoin(
        products,
        and(
          eq(products.id, productionLogs.productId),
          eq(products.businessId, productionLogs.businessId),
        ),
      )
      .leftJoin(
        inventoryLocations,
        and(
          eq(inventoryLocations.id, productionLogs.inventoryLocationId),
          eq(inventoryLocations.businessId, productionLogs.businessId),
        ),
      )
      .where(and(eq(productionLogs.businessId, access.business.id)))
      .orderBy(desc(productionLogs.createdAt))
      .limit(10),
  ]);

  return {
    inventoryLocations: centralLocations,
    products: recipeProducts,
    recentLogs,
  };
}

export async function getInventoryWorkspace(shiftId?: string) {
  const { access, shift } = await resolveOperationalShift({
    shiftId,
    statuses: ["active", "closing"],
  });
  if (!shift.inventoryLocationId) {
    throw new AccessError("The shift inventory location is not available.");
  }
  const database = requireDatabase();
  const [balances, openingCounts, recentEvents] = await Promise.all([
    database
      .select({
        inventoryItemId: inventoryItems.id,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        quantityOnHand: inventoryBalances.quantityOnHand,
      })
      .from(inventoryBalances)
      .innerJoin(
        inventoryItems,
        and(
          eq(inventoryItems.id, inventoryBalances.inventoryItemId),
          eq(inventoryItems.businessId, inventoryBalances.businessId),
        ),
      )
      .where(
        and(
          eq(inventoryBalances.businessId, access.business.id),
          eq(inventoryBalances.inventoryLocationId, shift.inventoryLocationId),
          ne(inventoryItems.status, "deleted"),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .orderBy(asc(inventoryItems.name)),
    database
      .select({
        inventoryItemId: shiftInventoryCounts.inventoryItemId,
        countedQuantity: shiftInventoryCounts.countedQuantity,
      })
      .from(shiftInventoryCounts)
      .where(
        and(
          eq(shiftInventoryCounts.businessId, access.business.id),
          eq(shiftInventoryCounts.shiftId, shift.id),
          eq(shiftInventoryCounts.countType, "opening"),
        ),
      ),
    database
      .select({
        id: inventoryEvents.id,
        eventType: inventoryEvents.eventType,
        createdAt: inventoryEvents.createdAt,
        itemName: inventoryItems.name,
        quantityDelta: inventoryEventLines.quantityDelta,
        unit: inventoryEventLines.unit,
      })
      .from(inventoryEvents)
      .innerJoin(
        inventoryEventLines,
        and(
          eq(inventoryEventLines.eventId, inventoryEvents.id),
          eq(inventoryEventLines.businessId, inventoryEvents.businessId),
        ),
      )
      .innerJoin(
        inventoryItems,
        and(
          eq(inventoryItems.id, inventoryEventLines.inventoryItemId),
          eq(inventoryItems.businessId, inventoryEventLines.businessId),
        ),
      )
      .where(
        and(
          eq(inventoryEvents.businessId, access.business.id),
          eq(inventoryEvents.shiftId, shift.id),
          eq(inventoryEvents.inventoryLocationId, shift.inventoryLocationId),
        ),
      )
      .orderBy(desc(inventoryEvents.createdAt))
      .limit(20),
  ]);
  const openingByItem = new Map(
    openingCounts.map((count) => [
      count.inventoryItemId,
      count.countedQuantity,
    ]),
  );

  return {
    shift,
    balances: balances.map((balance) => ({
      ...balance,
      openingQuantity: openingByItem.get(balance.inventoryItemId) ?? "0.000",
    })),
    recentEvents,
    approvalsEnabled: access.business.features.approvalsEnabled,
  };
}
