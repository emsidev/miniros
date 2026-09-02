"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createProductCategory,
  listProductCategories,
  reorderProductCategories,
  softDeleteProductCategory,
  updateProductCategory,
} from "../services/product-categories";
import { actionError } from "./helpers";

const categoryNameSchema = z.object({
  name: z.string().trim().min(2).max(80),
});
const categoryIdSchema = z.object({ categoryId: z.string().uuid() });
const updateCategorySchema = categoryNameSchema.extend({
  categoryId: z.string().uuid(),
});
const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1),
});
const emptyInputSchema = z.object({}).strict();

function revalidateCategoryPaths() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/categories");
  revalidatePath("/admin/inventory/recipes");
  revalidatePath("/pos");
}

export async function listProductCategoriesAction(input: unknown = {}) {
  try {
    emptyInputSchema.parse(input);
    return actionSuccess(await listProductCategories());
  } catch (error) {
    return actionError(error);
  }
}

export async function createProductCategoryAction(input: unknown) {
  try {
    const values = categoryNameSchema.parse(input);
    const result = await createProductCategory(values);
    revalidateCategoryPaths();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateProductCategoryAction(input: unknown) {
  try {
    const { categoryId, ...values } = updateCategorySchema.parse(input);
    const result = await updateProductCategory(categoryId, values);
    revalidateCategoryPaths();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function reorderProductCategoriesAction(input: unknown) {
  try {
    const { categoryIds } = reorderCategoriesSchema.parse(input);
    const result = await reorderProductCategories(categoryIds);
    revalidateCategoryPaths();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteProductCategoryAction(input: unknown) {
  try {
    const { categoryId } = categoryIdSchema.parse(input);
    const result = await softDeleteProductCategory(categoryId);
    revalidateCategoryPaths();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
