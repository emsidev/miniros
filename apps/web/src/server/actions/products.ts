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

const productWriteObject = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(80).nullable().optional().default(null),
  description: z.string().trim().max(1_000).nullable().optional().default(null),
  priceCents: centsSchema,
  manualCostCents: centsSchema,
  costOverrideCents: centsSchema.nullable().optional().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
  isSellable: z.boolean().default(true),
  requiresRecipeDeduction: z.boolean().optional().default(false),
  inventoryMode: z.enum(["none", "recipe", "produced"]).default("none"),
  outputInventoryItemId: z.string().uuid().nullable().optional().default(null),
  imageUrl: z
    .string()
    .trim()
    .url()
    .max(2_000)
    .nullable()
    .optional()
    .default(null),
});

const productWriteSchema = productWriteObject.superRefine((input, context) => {
  if (input.inventoryMode === "produced" && !input.outputInventoryItemId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["outputInventoryItemId"],
      message: "Choose a finished-good output item for produced stock.",
    });
  }
  if (input.inventoryMode !== "produced" && input.outputInventoryItemId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["outputInventoryItemId"],
      message: "Only produced-stock products can have an output item.",
    });
  }
});

const updateProductSchema = productWriteObject
  .extend({
    productId: z.string().uuid(),
  })
  .superRefine((input, context) => {
    if (input.inventoryMode === "produced" && !input.outputInventoryItemId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputInventoryItemId"],
        message: "Choose a finished-good output item for produced stock.",
      });
    }
    if (input.inventoryMode !== "produced" && input.outputInventoryItemId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["outputInventoryItemId"],
        message: "Only produced-stock products can have an output item.",
      });
    }
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
    revalidatePath("/admin/products/categories");
    revalidatePath("/admin/inventory/recipes");
    revalidatePath("/admin/inventory/stock");
    revalidatePath("/production");
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
    revalidatePath("/admin/products/categories");
    revalidatePath("/admin/inventory/recipes");
    revalidatePath("/admin/inventory/stock");
    revalidatePath("/production");
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
    revalidatePath("/admin/products/categories");
    revalidatePath("/admin/inventory/recipes");
    revalidatePath("/admin/inventory/stock");
    revalidatePath("/production");
    revalidatePath("/pos");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
