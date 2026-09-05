"use server";

import { actionSuccess } from "@miniros/contracts";
import { normalizeQuantity } from "@miniros/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "./helpers";
import {
  createCentralInventoryLocation,
  receiveStock,
  transferStock,
} from "../services/stock-operations";

const uuid = z.string().uuid();
const quantity = z
  .union([z.number().finite(), z.string().trim().min(1).max(32)])
  .transform((value, context) => {
    try {
      return normalizeQuantity(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid quantity.",
      });
      return z.NEVER;
    }
  })
  .refine((value) => value > 0, "Quantity must be positive.");
const line = z.object({ inventoryItemId: uuid, quantity }).strict();
const centralLocationSchema = z
  .object({ name: z.string().trim().min(2).max(120) })
  .strict();
const receivingSchema = z
  .object({
    receivingId: uuid,
    inventoryEventId: uuid,
    inventoryLocationId: uuid,
    referenceNumber: z.string().trim().max(120).nullable(),
    notes: z.string().trim().max(2_000).nullable(),
    lines: z.array(line).min(1).max(100),
  })
  .strict();
const transferSchema = z
  .object({
    transferId: uuid,
    transferOutEventId: uuid,
    transferInEventId: uuid,
    fromInventoryLocationId: uuid,
    toInventoryLocationId: uuid,
    notes: z.string().trim().max(2_000).nullable(),
    lines: z.array(line).min(1).max(100),
  })
  .strict();

function refreshStock() {
  // Cache invalidation cannot turn an already committed movement into a failure.
  try {
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/stock");
    revalidatePath("/inventory");
  } catch (error) {
    console.error("Stock saved, refresh failed", error);
  }
}

export async function createCentralInventoryLocationAction(input: unknown) {
  try {
    const result = await createCentralInventoryLocation(
      centralLocationSchema.parse(input).name,
    );
    refreshStock();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function receiveStockAction(input: unknown) {
  try {
    const result = await receiveStock(receivingSchema.parse(input));
    refreshStock();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function transferStockAction(input: unknown) {
  try {
    const result = await transferStock(transferSchema.parse(input));
    refreshStock();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
