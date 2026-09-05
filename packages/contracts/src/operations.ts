import { z } from "zod";
import { normalizeQuantity } from "@miniros/domain";
import { paymentMethods } from "./constants";

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

export const startShiftSchema = z
  .object({
    shiftId: uuidSchema,
    inventoryLocationId: uuidSchema,
    openingEventId: uuidSchema,
    counts: countsSchema,
    notes: nullableText(2_000),
  })
  .strict();
export const saleSchema = z
  .object({
    saleId: uuidSchema,
    shiftId: uuidSchema,
    inventoryEventId: uuidSchema,
    discount: z
      .object({
        promoId: uuidSchema,
        proofFileId: uuidSchema,
      })
      .strict()
      .optional(),
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
export const productionSchema = z
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
export const cashDeductionSchema = z
  .object({
    deductionId: uuidSchema,
    shiftId: uuidSchema,
    label: z.string().trim().min(1).max(120),
    amountCents: centsSchema.positive(),
    reason: nullableText(2_000),
  })
  .strict();
export const inventoryAdjustmentSchema = z
  .object({
    adjustmentId: uuidSchema,
    inventoryEventId: uuidSchema,
    shiftId: uuidSchema,
    inventoryItemId: uuidSchema,
    quantityDelta: nonzeroQuantitySchema,
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();
export const reviewCashSchema = z
  .object({
    deductionId: uuidSchema,
    decision: z.enum(["approved", "rejected"]),
  })
  .strict();
export const reviewAdjustmentSchema = z.discriminatedUnion("decision", [
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
export const closeoutSchema = z
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
