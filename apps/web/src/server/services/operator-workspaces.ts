import { requireDatabase } from "@miniros/db";
import {
  inventoryBalances,
  inventoryEventLines,
  inventoryEvents,
  inventoryItems,
  productCategories,
  productRecipeItems,
  productionLogs,
  products,
  sales,
  shiftInventoryCounts,
} from "@miniros/db/schema";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";

import { AccessError } from "./access";
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
  const [catalog, recentSales] = await Promise.all([
    database
      .select({
        id: products.id,
        name: products.name,
        categoryName: productCategories.name,
        priceCents: products.priceCents,
        requiresRecipeDeduction: products.requiresRecipeDeduction,
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
  ]);

  return { shift, products: catalog, recentSales };
}

export async function getProductionWorkspace(shiftId?: string) {
  const { access, shift } = await resolveOperationalShift({
    permission: "production",
    shiftId,
    statuses: ["active"],
  });
  const database = requireDatabase();
  const [recipeProducts, recentLogs] = await Promise.all([
    database
      .selectDistinct({ id: products.id, name: products.name })
      .from(products)
      .innerJoin(
        productRecipeItems,
        and(
          eq(productRecipeItems.productId, products.id),
          eq(productRecipeItems.businessId, products.businessId),
          isNull(productRecipeItems.deletedAt),
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
      .where(
        and(
          eq(productionLogs.businessId, access.business.id),
          eq(productionLogs.shiftId, shift.id),
        ),
      )
      .orderBy(desc(productionLogs.createdAt))
      .limit(10),
  ]);

  return { shift, products: recipeProducts, recentLogs };
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
  };
}
