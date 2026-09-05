import { z } from "zod";
import {
  startShiftSchema,
  saleSchema,
  cashDeductionSchema,
  inventoryAdjustmentSchema,
  closeoutSchema,
} from "./operations";

export const OFFLINE_SCHEMA_VERSION = 1 as const;
export const offlineOperationSchema = z
  .discriminatedUnion("type", [
    z
      .object({ type: z.literal("START_SHIFT"), payload: startShiftSchema })
      .strict(),
    z
      .object({
        type: z.literal("CREATE_SALE"),
        payload: saleSchema,
        discountProof: z
          .object({
            fileId: z.string().uuid(),
            name: z.string().min(1).max(200),
            mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
            size: z.number().int().positive().max(3_500_000),
          })
          .strict()
          .optional(),
        proofs: z
          .array(
            z
              .object({
                fileId: z.string().uuid(),
                paymentId: z.string().uuid(),
                name: z.string().max(200),
                mimeType: z.enum([
                  "image/jpeg",
                  "image/png",
                  "image/webp",
                  "application/pdf",
                ]),
                size: z.number().int().positive().max(3_500_000),
              })
              .strict(),
          )
          .max(10)
          .default([]),
      })
      .strict(),
    z
      .object({
        type: z.literal("CREATE_CASH_DEDUCTION"),
        payload: cashDeductionSchema,
      })
      .strict(),
    z
      .object({
        type: z.literal("CREATE_INVENTORY_ADJUSTMENT"),
        payload: inventoryAdjustmentSchema,
      })
      .strict(),
    z
      .object({ type: z.literal("SUBMIT_CLOSEOUT"), payload: closeoutSchema })
      .strict(),
  ])
  .superRefine((operation, context) => {
    if (operation.type !== "CREATE_SALE") return;
    const discount = operation.payload.discount;
    if (
      Boolean(discount) !== Boolean(operation.discountProof) ||
      (discount &&
        (discount.proofFileId.toLowerCase() !==
          operation.discountProof?.fileId.toLowerCase() ||
          operation.proofs.some(
            (p) =>
              p.fileId.toLowerCase() === discount.proofFileId.toLowerCase(),
          )))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discountProof"],
        message: "A matching discount photo is required for this sale.",
      });
    }
    const proofs = operation.proofs;
    if (
      new Set(proofs.map((proof) => proof.fileId.toLowerCase())).size !==
        proofs.length ||
      new Set(proofs.map((proof) => proof.paymentId.toLowerCase())).size !==
        proofs.length ||
      proofs.some(
        (proof) =>
          !operation.payload.payments.some(
            (payment) =>
              payment.id.toLowerCase() === proof.paymentId.toLowerCase() &&
              payment.paymentMethod !== "cash",
          ),
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proofs"],
        message:
          "Proof declarations must reference unique non-cash payments in this sale.",
      });
    }
  });
export const offlineEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(OFFLINE_SCHEMA_VERSION),
    id: z.string().uuid(),
    sessionId: z.string().uuid(),
    snapshotId: z.string().uuid(),
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    occurredAt: z.string().datetime(),
    operation: offlineOperationSchema,
  })
  .strict();
export type OfflineEnvelope = z.infer<typeof offlineEnvelopeSchema>;
export type OfflineOperation = z.infer<typeof offlineOperationSchema>;
export type PreparedSnapshot = {
  schemaVersion: 1;
  id: string;
  preparedAt: string;
  businessId: string;
  businessName: string;
  userId: string;
  employeeId: string;
  shiftId: string;
  locationName: string;
  shiftDate: string;
  inventoryLocationId: string;
  storageInstallationId: string;
  features: {
    recipesEnabled: boolean;
    promosEnabled: boolean;
    approvalsEnabled: boolean;
  };
  products: {
    id: string;
    name: string;
    categoryName: string | null;
    priceCents: number;
    costCents: number;
    requiresRecipeDeduction: boolean;
    producedInventoryItemId: string | null;
  }[];
  inventory: {
    id: string;
    name: string;
    unit: string;
    defaultUnitCostCents: number;
  }[];
  recipes: {
    productId: string;
    inventoryItemId: string;
    quantityPerProduct: string;
    unit: string;
  }[];
  promos: {
    requiresPhoto?: boolean;
    id: string;
    name: string;
    discountType: "fixed_amount" | "percentage";
    discountValue: number;
  }[];
  costs: {
    rentCents: number;
    transportCents: number;
    otherCents: number;
    salaryCents: number;
  };
};
export type PreparedShift = {
  id: string;
  deviceId: string;
  snapshot: PreparedSnapshot;
  status:
    "prepared" | "active" | "closing" | "closed" | "recovery" | "released";
  acknowledgedSequence: number;
  lastError: string | null;
};
export type SyncReply =
  | {
      ok: true;
      sequence: number;
      result: Record<string, unknown>;
      sessionStatus: PreparedShift["status"];
    }
  | {
      ok: false;
      code: "AUTH" | "CONFLICT" | "WAITING_REVIEW" | "PROOF_PENDING" | "RETRY";
      error: string;
    };
