"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "./helpers";
import {
  createBusiness,
  switchActiveBusiness,
  updateBusinessSettings,
} from "../services/businesses";

const createBusinessSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

const businessIdSchema = z.string().uuid();
const businessSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
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
