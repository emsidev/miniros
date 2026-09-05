"use server";

import {
  actionSuccess,
  startShiftSchema,
  saleSchema,
  productionSchema,
  cashDeductionSchema,
  inventoryAdjustmentSchema,
  reviewCashSchema,
  reviewAdjustmentSchema,
  closeoutSchema,
} from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  reviewCashDeduction,
  submitCashDeduction,
} from "../services/cash-deduction-operations";
import {
  reviewInventoryAdjustment,
  submitInventoryAdjustment,
} from "../services/inventory-adjustment-operations";
import { attachDiscountProof } from "../services/discount-proofs";
import { attachPaymentProof } from "../services/payment-proofs";
import { logProduction } from "../services/production-operations";
import { finalizeSale } from "../services/sales-operations";
import { submitShiftCloseout } from "../services/shift-closeout";
import { startAssignedShift } from "../services/shift-start";
import { joinShift } from "../services/shift-join";
import { actionError } from "./helpers";

const uuidSchema = z.string().uuid();
const proofFileSchema = z
  .custom<File>((value) => value instanceof File, "Select a proof file.")
  .refine((file) => file.size > 0 && file.size <= 3_500_000, {
    message: "Payment proof files must be no larger than 3.5 MB.",
  })
  .refine(
    (file) =>
      ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
        file.type,
      ),
    { message: "Use a JPEG, PNG, WebP, or PDF payment proof." },
  );
const paymentProofFormSchema = z
  .custom<FormData>((value) => value instanceof FormData, "Invalid form data.")
  .transform((formData) => ({
    paymentId: formData.get("paymentId"),
    fileId: formData.get("fileId"),
    file: formData.get("file"),
  }))
  .pipe(
    z.object({
      paymentId: uuidSchema,
      fileId: uuidSchema,
      file: proofFileSchema,
    }),
  );

async function execute<TSchema extends z.ZodTypeAny, TResult>(
  schema: TSchema,
  input: unknown,
  operation: (values: z.output<TSchema>) => Promise<TResult>,
  paths: readonly string[],
) {
  try {
    const result = await operation(schema.parse(input));
    // A refresh failure must not turn an already committed sale into a rejection.
    try {
      paths.forEach((path) => revalidatePath(path));
    } catch (error) {
      console.error("Operation saved, refresh failed", error);
    }
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

const operatorPaths = [
  "/shifts",
  "/schedule",
  "/inventory",
  "/production",
  "/pos",
] as const;
const adminPaths = [
  "/admin/dashboard",
  "/admin/shifts",
  "/admin/approvals",
  "/admin/reports",
] as const;

export async function startAssignedShiftAction(input: unknown) {
  return execute(startShiftSchema, input, startAssignedShift, operatorPaths);
}
export async function joinShiftAction(input: unknown) {
  const result = await execute(uuidSchema, input, joinShift, [
    ...operatorPaths,
    ...adminPaths,
  ]);
  if (result.ok) {
    try {
      const shiftId = result.data.shiftId;
      revalidatePath(`/shifts/${shiftId}`, "layout");
      revalidatePath(`/admin/shifts/${shiftId}`, "layout");
    } catch (error) {
      console.error("Shift joined, detail refresh failed", error);
    }
  }
  return result;
}
export async function finalizeSaleAction(input: unknown) {
  return execute(saleSchema, input, finalizeSale, operatorPaths);
}
export async function uploadPaymentProofAction(input: unknown) {
  return execute(
    paymentProofFormSchema,
    input,
    attachPaymentProof,
    operatorPaths,
  );
}
export async function logProductionAction(input: unknown) {
  return execute(productionSchema, input, logProduction, operatorPaths);
}
export async function submitCashDeductionAction(input: unknown) {
  return execute(
    cashDeductionSchema,
    input,
    submitCashDeduction,
    operatorPaths,
  );
}
export async function submitInventoryAdjustmentAction(input: unknown) {
  return execute(
    inventoryAdjustmentSchema,
    input,
    submitInventoryAdjustment,
    operatorPaths,
  );
}
export async function reviewCashDeductionAction(input: unknown) {
  return execute(reviewCashSchema, input, reviewCashDeduction, adminPaths);
}
export async function reviewInventoryAdjustmentAction(input: unknown) {
  return execute(
    reviewAdjustmentSchema,
    input,
    reviewInventoryAdjustment,
    adminPaths,
  );
}
export async function submitShiftCloseoutAction(input: unknown) {
  return execute(closeoutSchema, input, submitShiftCloseout, [
    ...operatorPaths,
    ...adminPaths,
  ]);
}

export async function uploadDiscountProofAction(form: FormData) {
  try {
    const result = await attachDiscountProof({
      saleId: String(form.get("saleId")),
      fileId: String(form.get("fileId")),
      file: form.get("file") as File,
    });
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
