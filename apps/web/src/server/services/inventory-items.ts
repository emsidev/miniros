import { randomUUID } from "node:crypto";
import { normalizeSku, selectAvailableAutomaticSku } from "@miniros/domain";
import type { InventoryItemType, InventoryUnit } from "@miniros/contracts";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  inventoryBalances,
  inventoryEventLines,
  inventoryItems,
  productRecipeItems,
  productProductionOutputs,
  shiftInventoryCounts,
} from "@miniros/db/schema";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import {
  loadProductCostBreakdowns,
  recalculateProductCosts,
} from "./product-costing";

export type InventoryItemWriteInput = {
  name: string;
  sku: string | null;
  itemType: InventoryItemType;
  unit: InventoryUnit;
  defaultUnitCostCents: number;
  trackStock: boolean;
  status: "active" | "inactive";
};

function nullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizedSku(value: string | null) {
  const normalized = nullableText(value);
  return normalized ? normalizeSku(normalized) : null;
}

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof requireDatabase>["transaction"]>[0]
>[0];

async function generateAvailableInventorySku(
  tx: DatabaseTransaction,
  businessId: string,
  name: string,
  excludeInventoryItemId?: string,
) {
  try {
    return await selectAvailableAutomaticSku({
      prefix: "INV",
      name,
      nextSuffix: () => randomUUID().replace(/-/g, "").slice(0, 4),
      isAvailable: async (sku) => {
        const [collision] = await tx
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.businessId, businessId),
              eq(inventoryItems.sku, sku),
              ...(excludeInventoryItemId
                ? [ne(inventoryItems.id, excludeInventoryItemId)]
                : []),
            ),
          )
          .limit(1);
        return !collision;
      },
    });
  } catch {
    throw new AccessError(
      "Could not generate a unique inventory SKU. Try again.",
    );
  }
}

function inventoryItemDto(row: typeof inventoryItems.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    itemType: row.itemType,
    unit: row.unit as InventoryUnit,
    defaultUnitCostCents: row.defaultUnitCostCents,
    trackStock: row.trackStock,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listInventoryItems() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const rows = await database
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.businessId, business.id),
        isNull(inventoryItems.deletedAt),
        ne(inventoryItems.status, "deleted"),
      ),
    )
    .orderBy(asc(inventoryItems.name));

  return rows.map(inventoryItemDto);
}

export async function createInventoryItem(input: InventoryItemWriteInput) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const requestedSku = normalizedSku(input.sku);
    const [matchingSku] = requestedSku
      ? await tx
          .select({ id: inventoryItems.id, status: inventoryItems.status })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.businessId, access.business.id),
              eq(inventoryItems.sku, requestedSku),
            ),
          )
          .limit(1)
      : [];
    if (matchingSku && matchingSku.status !== "deleted") {
      throw new AccessError("An inventory item with that SKU already exists.");
    }

    const sku =
      requestedSku ??
      (await generateAvailableInventorySku(tx, access.business.id, input.name));
    const restorable = matchingSku?.status === "deleted" ? matchingSku : null;
    const inventoryItemId = restorable?.id ?? randomUUID();
    const values = {
      name: input.name.trim(),
      sku,
      itemType: input.itemType,
      unit: input.unit,
      defaultUnitCostCents: input.defaultUnitCostCents,
      trackStock: input.trackStock,
      status: input.status,
      deletedAt: null,
      updatedAt: new Date(),
    };
    const [created] = restorable
      ? await tx
          .update(inventoryItems)
          .set(values)
          .where(
            and(
              eq(inventoryItems.id, inventoryItemId),
              eq(inventoryItems.businessId, access.business.id),
              eq(inventoryItems.status, "deleted"),
            ),
          )
          .returning()
      : await tx
          .insert(inventoryItems)
          .values({
            id: inventoryItemId,
            businessId: access.business.id,
            ...values,
          })
          .returning();

    if (!created) {
      throw new Error("Inventory item insert did not return a row.");
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: restorable ? "inventory_item.restored" : "inventory_item.created",
      entityType: "inventory_item",
      entityId: inventoryItemId,
      metadata: {
        name: created.name,
        itemType: created.itemType,
        unit: created.unit,
        defaultUnitCostCents: created.defaultUnitCostCents,
        restored: Boolean(restorable),
      },
    });

    return inventoryItemDto(created);
  });
}

export async function updateInventoryItem(
  inventoryItemId: string,
  input: InventoryItemWriteInput,
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, inventoryItemId),
          eq(inventoryItems.businessId, access.business.id),
          isNull(inventoryItems.deletedAt),
          ne(inventoryItems.status, "deleted"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AccessError("Inventory item not found.");
    }

    if (
      input.itemType !== existing.itemType ||
      input.trackStock !== existing.trackStock ||
      input.status !== existing.status
    ) {
      const [outputMapping] = await tx
        .select({ productId: productProductionOutputs.productId })
        .from(productProductionOutputs)
        .where(
          and(
            eq(productProductionOutputs.businessId, access.business.id),
            eq(productProductionOutputs.inventoryItemId, inventoryItemId),
          ),
        )
        .limit(1);
      if (
        outputMapping &&
        (input.itemType !== "finished_good" ||
          !input.trackStock ||
          input.status !== "active")
      ) {
        throw new AccessError(
          "Unmap this finished-good item from its product before changing its stock settings.",
        );
      }
    }

    if (input.unit !== existing.unit) {
      const [activeRecipe, historicalEvent, balance, shiftCount] =
        await Promise.all([
          tx
            .select({ id: productRecipeItems.id })
            .from(productRecipeItems)
            .where(
              and(
                eq(productRecipeItems.businessId, access.business.id),
                eq(productRecipeItems.inventoryItemId, inventoryItemId),
                isNull(productRecipeItems.deletedAt),
              ),
            )
            .limit(1),
          tx
            .select({ id: inventoryEventLines.id })
            .from(inventoryEventLines)
            .where(
              and(
                eq(inventoryEventLines.businessId, access.business.id),
                eq(inventoryEventLines.inventoryItemId, inventoryItemId),
              ),
            )
            .limit(1),
          tx
            .select({ id: inventoryBalances.id })
            .from(inventoryBalances)
            .where(
              and(
                eq(inventoryBalances.businessId, access.business.id),
                eq(inventoryBalances.inventoryItemId, inventoryItemId),
              ),
            )
            .limit(1),
          tx
            .select({ id: shiftInventoryCounts.id })
            .from(shiftInventoryCounts)
            .where(
              and(
                eq(shiftInventoryCounts.businessId, access.business.id),
                eq(shiftInventoryCounts.inventoryItemId, inventoryItemId),
              ),
            )
            .limit(1),
        ]);

      if (
        activeRecipe[0] ||
        historicalEvent[0] ||
        balance[0] ||
        shiftCount[0]
      ) {
        throw new AccessError(
          "Create a new inventory item to use a different unit once it has recipes or stock history.",
        );
      }
    }

    const requestedSku = normalizedSku(input.sku);
    const sku = requestedSku
      ? requestedSku
      : await generateAvailableInventorySku(
          tx,
          access.business.id,
          input.name,
          inventoryItemId,
        );
    if (requestedSku) {
      const [duplicate] = await tx
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.businessId, access.business.id),
            eq(inventoryItems.sku, sku),
            ne(inventoryItems.id, inventoryItemId),
          ),
        )
        .limit(1);
      if (duplicate) {
        throw new AccessError(
          "An inventory item with that SKU already exists.",
        );
      }
    }

    const affectedProductIds =
      input.defaultUnitCostCents !== existing.defaultUnitCostCents
        ? [
            ...new Set(
              (
                await tx
                  .select({ productId: productRecipeItems.productId })
                  .from(productRecipeItems)
                  .where(
                    and(
                      eq(productRecipeItems.businessId, access.business.id),
                      eq(productRecipeItems.inventoryItemId, inventoryItemId),
                      isNull(productRecipeItems.deletedAt),
                    ),
                  )
              ).map((row) => row.productId),
            ),
          ]
        : [];
    const previousBreakdowns = await loadProductCostBreakdowns(tx, {
      businessId: access.business.id,
      recipesEnabled: access.business.features.recipesEnabled,
      productIds: affectedProductIds,
    });

    const [updated] = await tx
      .update(inventoryItems)
      .set({
        name: input.name.trim(),
        sku,
        itemType: input.itemType,
        unit: input.unit,
        defaultUnitCostCents: input.defaultUnitCostCents,
        trackStock: input.trackStock,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryItems.id, inventoryItemId),
          eq(inventoryItems.businessId, access.business.id),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Inventory item update did not return a row.");
    }

    const costRecalculations = await recalculateProductCosts(tx, {
      businessId: access.business.id,
      recipesEnabled: access.business.features.recipesEnabled,
      productIds: affectedProductIds,
      trigger: "inventory_item_default_cost_changed",
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      previousBreakdowns,
    });

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "inventory_item.updated",
      entityType: "inventory_item",
      entityId: inventoryItemId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        itemType: updated.itemType,
        unit: updated.unit,
        defaultUnitCostCents: updated.defaultUnitCostCents,
        affectedProductIds,
        recalculatedProductCount: costRecalculations.length,
      },
    });

    return inventoryItemDto(updated);
  });
}

export async function softDeleteInventoryItem(inventoryItemId: string) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: inventoryItems.id, name: inventoryItems.name })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, inventoryItemId),
          eq(inventoryItems.businessId, access.business.id),
          isNull(inventoryItems.deletedAt),
          ne(inventoryItems.status, "deleted"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AccessError("Inventory item not found.");
    }

    const [activeRecipe] = await tx
      .select({ id: productRecipeItems.id })
      .from(productRecipeItems)
      .where(
        and(
          eq(productRecipeItems.businessId, access.business.id),
          eq(productRecipeItems.inventoryItemId, inventoryItemId),
          isNull(productRecipeItems.deletedAt),
        ),
      )
      .limit(1);

    if (activeRecipe) {
      throw new AccessError(
        "Remove this item from active recipes before deleting it.",
      );
    }
    const [outputMapping] = await tx
      .select({ productId: productProductionOutputs.productId })
      .from(productProductionOutputs)
      .where(
        and(
          eq(productProductionOutputs.businessId, access.business.id),
          eq(productProductionOutputs.inventoryItemId, inventoryItemId),
        ),
      )
      .limit(1);
    if (outputMapping) {
      throw new AccessError(
        "Unmap this finished-good item from its product before deleting it.",
      );
    }

    const deletedAt = new Date();
    await tx
      .update(inventoryItems)
      .set({ status: "deleted", deletedAt, updatedAt: deletedAt })
      .where(
        and(
          eq(inventoryItems.id, inventoryItemId),
          eq(inventoryItems.businessId, access.business.id),
        ),
      );

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "inventory_item.deleted",
      entityType: "inventory_item",
      entityId: inventoryItemId,
      metadata: { name: existing.name },
    });

    return { id: inventoryItemId, deletedAt: deletedAt.toISOString() };
  });
}
