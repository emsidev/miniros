"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError } from "./helpers";
import { createPromo, setPromoStatus } from "../services/promos";

const promoWriteSchema = z
  .object({
    promoId: z.string().uuid().optional(),
    requiresPhoto: z.boolean().optional().default(false),
    name: z.string().trim().min(2).max(120),
    discountType: z.enum(["fixed_amount", "percentage"]),
    discountValue: z.number().finite().positive().max(1_000_000),
    startsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .strict()
  .superRefine((values, context) => {
    if (values.discountType === "percentage" && values.discountValue > 100) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 100,
        type: "number",
        inclusive: true,
        path: ["discountValue"],
        message: "Percentage discounts cannot exceed 100%.",
      });
    }
  });
const statusSchema = z
  .object({
    promoId: z.string().uuid(),
    status: z.enum(["active", "inactive"]),
  })
  .strict();

export async function createPromoAction(input: unknown) {
  try {
    const values = promoWriteSchema.parse(input);
    return actionSuccess(await createPromo(values, values.promoId));
  } catch (error) {
    return actionError(error);
  } finally {
    revalidatePath("/admin/promos");
    revalidatePath("/pos");
  }
}

export async function setPromoStatusAction(input: unknown) {
  try {
    const values = statusSchema.parse(input);
    const result = await setPromoStatus(values.promoId, values.status);
    revalidatePath("/admin/promos");
    revalidatePath("/pos");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
