"use server";

import { actionSuccess, paymentMethods } from "@miniros/contracts";
import { normalizeQuantity } from "@miniros/domain";
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
import { attachPaymentProof } from "../services/payment-proofs";
import { logProduction } from "../services/production-operations";
import { finalizeSale } from "../services/sales-operations";
import { submitShiftCloseout } from "../services/shift-closeout";
import { startAssignedShift } from "../services/shift-start";
import { actionError } from "./helpers";

const uuidSchema = z.string().uuid();
const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional().default(null);
const normalizedQuantitySchema = z
  .union([z.number().finite(), z.string().trim().min(1).max(32)])
  .transform((value, context) => {
    try {
      return normalizeQuantity(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use a valid quantity within the supported range.",
      });
      return z.NEVER;
    }
  });
const positiveQuantitySchema = normalizedQuantitySchema.refine(
  (value) => value > 0,
  "Quantity must be positive.",
);
const nonnegativeQuantitySchema = normalizedQuantitySchema.refine(
  (value) => value >= 0,
  "Quantity must not be negative.",
);
const nonzeroQuantitySchema = normalizedQuantitySchema.refine(
  (value) => value !== 0,
  "Quantity must not be zero.",
);
const countSchema = z.object({
  inventoryItemId: uuidSchema,
  quantity: nonnegativeQuantitySchema,
});
const countsSchema = z
  .array(countSchema)
  .min(1)
  .max(500)
  .refine(
    (counts) =>
      new Set(counts.map((count) => count.inventoryItemId)).size ===
      counts.length,
    "Each inventory item may be counted only once.",
  );

const startShiftSchema = z
  .object({
    shiftId: uuidSchema,
    inventoryLocationId: uuidSchema,
    openingEventId: uuidSchema,
    counts: countsSchema,
    notes: nullableText(2_000),
  })
  .strict();
const saleSchema = z
  .object({
    saleId: uuidSchema,
    shiftId: uuidSchema,
    inventoryEventId: uuidSchema,
    items: z
      .array(
        z
          .object({
            id: uuidSchema,
            productId: uuidSchema,
            quantity: positiveQuantitySchema,
            discountCents: centsSchema.optional().default(0),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    payments: z
      .array(
        z
          .object({
            id: uuidSchema,
            paymentMethod: z.enum(paymentMethods),
            amountCents: centsSchema.positive(),
            referenceNumber: nullableText(200),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();
const productionSchema = z
  .object({
    productionLogId: uuidSchema,
    productionInputEventId: uuidSchema,
    productionOutputEventId: uuidSchema,
    inventoryLocationId: uuidSchema,
    productId: uuidSchema,
    quantityProduced: positiveQuantitySchema,
    notes: nullableText(2_000),
  })
  .strict()
  .refine(
    (input) => input.productionInputEventId !== input.productionOutputEventId,
    "Production input and output event IDs must be different.",
  );
const cashDeductionSchema = z
  .object({
    deductionId: uuidSchema,
    shiftId: uuidSchema,
    label: z.string().trim().min(1).max(120),
    amountCents: centsSchema.positive(),
    reason: nullableText(2_000),
  })
  .strict();
const inventoryAdjustmentSchema = z
  .object({
    adjustmentId: uuidSchema,
    inventoryEventId: uuidSchema,
    shiftId: uuidSchema,
    inventoryItemId: uuidSchema,
    quantityDelta: nonzeroQuantitySchema,
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();
const reviewCashSchema = z
  .object({
    deductionId: uuidSchema,
    decision: z.enum(["approved", "rejected"]),
  })
  .strict();
const reviewAdjustmentSchema = z.discriminatedUnion("decision", [
  z
    .object({
      adjustmentId: uuidSchema,
      inventoryEventId: uuidSchema,
      decision: z.literal("approved"),
    })
    .strict(),
  z
    .object({
      adjustmentId: uuidSchema,
      inventoryEventId: uuidSchema.optional(),
      decision: z.literal("rejected"),
    })
    .strict(),
]);
const closeoutSchema = z
  .object({
    closeoutId: uuidSchema,
    cashReconciliationId: uuidSchema,
    profitSummaryId: uuidSchema,
    inventoryEventId: uuidSchema,
    shiftId: uuidSchema,
    actualCashCents: centsSchema,
    counts: countsSchema,
    notes: nullableText(2_000),
  })
  .strict();
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
    paths.forEach((path) => revalidatePath(path));
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
