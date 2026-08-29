"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createProduct,
  listProducts,
  softDeleteProduct,
  updateProduct,
} from "../services/products";
import { actionError } from "./helpers";

const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const productWriteSchema = z.object({
  categoryId: z.string().uuid().nullable().optional().default(null),
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(80).nullable().optional().default(null),
  description: z.string().trim().max(1_000).nullable().optional().default(null),
  priceCents: centsSchema,
  costCents: centsSchema,
  status: z.enum(["active", "inactive"]).default("active"),
  isSellable: z.boolean().default(true),
  requiresRecipeDeduction: z.boolean().default(false),
  imageUrl: z
    .string()
    .trim()
    .url()
    .max(2_000)
    .nullable()
    .optional()
    .default(null),
});

const updateProductSchema = productWriteSchema.extend({
  productId: z.string().uuid(),
});
const productIdSchema = z.object({ productId: z.string().uuid() });
const emptyInputSchema = z.object({}).strict();

export async function listProductsAction(input: unknown = {}) {
  try {
    emptyInputSchema.parse(input);
    return actionSuccess(await listProducts());
  } catch (error) {
    return actionError(error);
  }
}

export async function createProductAction(input: unknown) {
  try {
    const values = productWriteSchema.parse(input);
    const result = await createProduct(values);
    revalidatePath("/admin/products");
    revalidatePath("/pos");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProductAction(input: unknown) {
  try {
    const { productId, ...values } = updateProductSchema.parse(input);
    const result = await updateProduct(productId, values);
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory/recipes");
    revalidatePath("/pos");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteProductAction(input: unknown) {
  try {
    const { productId } = productIdSchema.parse(input);
    const result = await softDeleteProduct(productId);
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory/recipes");
    revalidatePath("/pos");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
