"use server";

import { actionSuccess } from "@miniros/contracts";
import { validateBusinessFeatureFlags } from "@miniros/domain";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "./helpers";
import {
  createBusiness,
  switchActiveBusiness,
  updateBusinessFeatures,
  updateBusinessSettings,
} from "../services/businesses";

const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const businessIdSchema = z.string().uuid();
const businessSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
});
const businessFeaturesSchema = z
  .object({
    recipesEnabled: z.boolean(),
    productionEnabled: z.boolean(),
    approvalsEnabled: z.boolean(),
    promosEnabled: z.boolean(),
  })
  .strict()
  .superRefine((values, context) => {
    try {
      validateBusinessFeatureFlags(values);
    } catch (error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["productionEnabled"],
        message:
          error instanceof Error ? error.message : "Invalid feature settings.",
      });
    }
  });

export async function createBusinessAction(input: unknown) {
  try {
    const values = createBusinessSchema.parse(input);
    const business = await createBusiness(values);
    revalidatePath("/businesses");
    return actionSuccess(business);
  } catch (error) {
    return actionError(error);
  }
}

export async function switchBusinessAction(input: unknown) {
  try {
    const businessId = businessIdSchema.parse(input);
    const result = await switchActiveBusiness(businessId);
    revalidatePath("/", "layout");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBusinessSettingsAction(input: unknown) {
  try {
    const values = businessSettingsSchema.parse(input);
    const result = await updateBusinessSettings(values);
    revalidatePath("/admin", "layout");
    revalidatePath("/businesses");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateBusinessFeaturesAction(input: unknown) {
  try {
    const values = businessFeaturesSchema.parse(input);
    const result = await updateBusinessFeatures(values);
    revalidatePath("/", "layout");
    revalidatePath("/admin", "layout");
    [
      "/admin/settings",
      "/admin/approvals",
      "/admin/promos",
      "/admin/production",
      "/admin/inventory",
      "/admin/inventory/recipes",
      "/admin/products",
      "/production",
      "/pos",
      "/inventory",
    ].forEach((path) => revalidatePath(path));
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
