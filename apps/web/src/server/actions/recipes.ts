"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listRecipe, replaceRecipe } from "../services/recipes";
import { actionError } from "./helpers";

const quantitySchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d{0,10})(?:\.\d{1,3})?$/,
    "Use a decimal quantity with at most three decimal places.",
  )
  .refine((value) => !/^0(?:\.0{1,3})?$/.test(value), {
    message: "Quantity must be greater than zero.",
  });

const recipeLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: quantitySchema,
  unit: z.string().trim().min(1).max(24),
});

const recipeSchema = z
  .object({
    productId: z.string().uuid(),
    lines: z.array(recipeLineSchema).max(100),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.lines.forEach((line, index) => {
      if (seen.has(line.inventoryItemId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lines", index, "inventoryItemId"],
          message: "Each inventory item can appear only once.",
        });
      }
      seen.add(line.inventoryItemId);
    });
  });

const productIdSchema = z.object({ productId: z.string().uuid() });

export async function listRecipeAction(input: unknown) {
  try {
    const { productId } = productIdSchema.parse(input);
    return actionSuccess(await listRecipe(productId));
  } catch (error) {
    return actionError(error);
  }
}

export async function replaceRecipeAction(input: unknown) {
  try {
    const { productId, lines } = recipeSchema.parse(input);
    const result = await replaceRecipe(productId, lines);
    revalidatePath("/admin/inventory/recipes");
    revalidatePath("/admin/products");
    revalidatePath("/pos");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
