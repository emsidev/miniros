import { randomUUID } from "node:crypto";
import type { InventoryItemType } from "@miniros/contracts";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  inventoryItems,
  productRecipeItems,
} from "@miniros/db/schema";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";

export type InventoryItemWriteInput = {
  name: string;
  sku: string | null;
  itemType: InventoryItemType;
  unit: string;
  defaultUnitCostCents: number;
  trackStock: boolean;
  status: "active" | "inactive";
};

function nullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function inventoryItemDto(row: typeof inventoryItems.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    itemType: row.itemType,
    unit: row.unit,
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
    const sku = nullableText(input.sku);
    const [restorable] = sku
      ? await tx
          .select({ id: inventoryItems.id })
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.businessId, access.business.id),
              eq(inventoryItems.sku, sku),
              eq(inventoryItems.status, "deleted"),
            ),
          )
          .limit(1)
      : [];
    const inventoryItemId = restorable?.id ?? randomUUID();
    const values = {
      name: input.name.trim(),
      sku,
      itemType: input.itemType,
      unit: input.unit.trim(),
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

    if (input.unit.trim() !== existing.unit) {
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
          "Update or remove this item from active recipes before changing its unit.",
        );
      }
    }

    const [updated] = await tx
      .update(inventoryItems)
      .set({
        name: input.name.trim(),
        sku: nullableText(input.sku),
        itemType: input.itemType,
        unit: input.unit.trim(),
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
