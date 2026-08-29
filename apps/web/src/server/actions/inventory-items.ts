"use server";

import { actionSuccess, inventoryItemTypes } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createInventoryItem,
  listInventoryItems,
  softDeleteInventoryItem,
  updateInventoryItem,
} from "../services/inventory-items";
import { actionError } from "./helpers";

const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const inventoryItemWriteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(80).nullable().optional().default(null),
  itemType: z.enum(inventoryItemTypes),
  unit: z.string().trim().min(1).max(24),
  defaultUnitCostCents: centsSchema.default(0),
  trackStock: z.boolean().default(true),
  status: z.enum(["active", "inactive"]).default("active"),
});

const updateInventoryItemSchema = inventoryItemWriteSchema.extend({
  inventoryItemId: z.string().uuid(),
});
const inventoryItemIdSchema = z.object({ inventoryItemId: z.string().uuid() });
const emptyInputSchema = z.object({}).strict();

export async function listInventoryItemsAction(input: unknown = {}) {
  try {
    emptyInputSchema.parse(input);
    return actionSuccess(await listInventoryItems());
  } catch (error) {
    return actionError(error);
  }
}

export async function createInventoryItemAction(input: unknown) {
  try {
    const values = inventoryItemWriteSchema.parse(input);
    const result = await createInventoryItem(values);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/recipes");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateInventoryItemAction(input: unknown) {
  try {
    const { inventoryItemId, ...values } =
      updateInventoryItemSchema.parse(input);
    const result = await updateInventoryItem(inventoryItemId, values);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/recipes");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteInventoryItemAction(input: unknown) {
  try {
    const { inventoryItemId } = inventoryItemIdSchema.parse(input);
    const result = await softDeleteInventoryItem(inventoryItemId);
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/items");
    revalidatePath("/admin/inventory/recipes");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
