import { z } from "zod";
import {
  v2Kinds,
  type V2Operation,
  type V2OperationBody,
  type V2Snapshot,
  type V2SnapshotBody,
} from "./types";

export const v2IdSchema = z
  .string()
  .uuid()
  .regex(/^[0-9a-f-]+$/, "Use canonical lowercase UUIDs.");
const id = v2IdSchema;
const integer = z.number().int().safe();
const nonnegative = integer.nonnegative();
const positive = integer.positive();
const text = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => v.trim().length > 0);
const reason = z
  .string()
  .min(1)
  .max(2000)
  .refine((v) => v.trim().length > 0);
export const v2DigestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const digest = v2DigestSchema;
const unit = z.enum(["g", "ml", "pc"]);
const unique = <T extends { id: string }>(values: readonly T[]) =>
  new Set(values.map((v) => v.id)).size === values.length;
const ingredient = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item"), itemId: id, atoms: positive }).strict(),
  z
    .object({
      kind: z.literal("recipe"),
      recipeId: id,
      quantity: positive.max(10000),
    })
    .strict(),
]);
const ingredients = z.array(ingredient).min(1).max(100);
export const v2CountSchema = z.discriminatedUnion("kind", [
  z.object({ itemId: id, kind: z.literal("uncounted") }).strict(),
  z.object({ itemId: id, kind: z.literal("not-brought") }).strict(),
  z
    .object({ itemId: id, kind: z.literal("counted"), atoms: nonnegative })
    .strict(),
]);
const counts = z
  .array(v2CountSchema)
  .min(1)
  .max(500)
  .refine(
    (v) => new Set(v.map((c) => c.itemId)).size === v.length,
    "Duplicate count item.",
  );
export const v2LineSchema = z
  .object({
    productId: id,
    quantity: positive.max(10000),
    modifierIds: z
      .array(id)
      .max(20)
      .refine((v) => new Set(v).size === v.length, "Duplicate modifier."),
  })
  .strict();
const lines = z.array(v2LineSchema).min(1).max(100);
const tenderMethod = z.enum(["cash", "manual_digital"]);
const stockRecord = z
  .record(id, nonnegative)
  .refine((v) => Object.keys(v).length <= 500);
const snapshotShape = {
  schemaVersion: z.literal(2),
  id,
  businessId: id,
  shiftId: id,
  version: positive,
  catalogVersion: text,
  recipeVersion: text,
  costingVersion: text,
  checklist: z
    .object({
      id,
      version: positive,
      entries: z
        .array(z.object({ id, label: text, critical: z.boolean() }).strict())
        .max(500)
        .refine(unique),
    })
    .strict(),
  items: z
    .array(
      z
        .object({
          id,
          name: text,
          category: text,
          unit,
          atomScale: z.union([
            z.literal(1),
            z.literal(10),
            z.literal(100),
            z.literal(1000),
          ]),
          prepared: z.boolean(),
          unitCostMinor: nonnegative,
          packs: z
            .array(z.object({ id, unit, atoms: positive }).strict())
            .max(20)
            .refine(unique),
        })
        .strict(),
    )
    .min(1)
    .max(500)
    .refine(unique),
  recipes: z
    .array(z.object({ id, ingredients }).strict())
    .min(1)
    .max(500)
    .refine(unique),
  products: z
    .array(
      z
        .object({
          id,
          name: text,
          priceMinor: nonnegative,
          costMinor: nonnegative,
          recipeId: id,
          modifierIds: z
            .array(id)
            .max(20)
            .refine((v) => new Set(v).size === v.length),
        })
        .strict(),
    )
    .min(1)
    .max(500)
    .refine(unique),
  modifiers: z
    .array(
      z
        .object({
          id,
          name: text,
          priceMinor: nonnegative,
          ingredients: z.array(ingredient).max(100),
        })
        .strict(),
    )
    .max(500)
    .refine(unique),
};
export const v2SnapshotBodySchema: z.ZodType<V2SnapshotBody> = z
  .object(snapshotShape)
  .strict();
export const v2SnapshotSchema: z.ZodType<V2Snapshot> = z
  .object({ ...snapshotShape, hash: digest })
  .strict();
const baseShape = {
  protocolVersion: z.literal(2),
  schemaVersion: z.literal(2),
  operationId: id,
  businessId: id,
  shiftId: id,
  snapshotId: id,
  snapshotHash: digest,
  installationId: id,
  authorityEpoch: positive,
  sequence: positive,
  occurredAt: z.string().datetime(),
};
const payloadShapes = {
  OPEN_SHIFT: z
    .object({
      counts,
      openingCashMinor: nonnegative,
      reviewed: z.literal(true),
    })
    .strict(),
  SALE: z
    .object({
      saleId: id,
      lines,
      discountMinor: nonnegative,
      tenders: z
        .array(
          z
            .object({
              method: tenderMethod,
              tenderedMinor: positive,
              changeMinor: nonnegative,
            })
            .strict(),
        )
        .min(1)
        .max(10),
    })
    .strict(),
  REFUND: z
    .object({ saleId: id, amountMinor: positive, method: tenderMethod, reason })
    .strict(),
  COMPLIMENTARY: z.object({ lines, reason }).strict(),
  REMAKE: z.object({ saleId: id, lines, reason }).strict(),
  RESTOCK: z.object({ itemId: id, atoms: positive, reason }).strict(),
  WASTE: z.object({ itemId: id, atoms: positive, reason }).strict(),
  ADJUST_STOCK: z
    .object({
      itemId: id,
      deltaAtoms: integer.refine((v) => v !== 0),
      reason,
      approvalId: id,
    })
    .strict(),
  RETURN_UNPREPARED: z
    .object({
      saleId: id,
      prepCommandId: id,
      prepConfirmedUnprepared: z.literal(true),
      physicallyReturned: z.literal(true),
      reason,
    })
    .strict(),
  PREP_TRANSITION: z
    .object({
      saleId: id,
      commandId: id,
      prepInstallationId: id,
      next: z.enum(["making", "done"]),
    })
    .strict(),
  CASH_ADJUSTMENT: z
    .object({ direction: z.enum(["in", "out"]), amountMinor: positive, reason })
    .strict(),
  CLOSE_SHIFT: z
    .object({
      manifestId: id,
      lastFinancialSequence: nonnegative,
      journalDigest: digest,
      expectedCashMinor: nonnegative,
      netSalesMinor: nonnegative,
      expectedStockAtoms: stockRecord,
      actualCashMinor: nonnegative.nullable(),
      counts,
      pendingAttachmentIds: z
        .array(id)
        .max(500)
        .refine((v) => new Set(v).size === v.length),
      manualResolutions: z
        .array(z.object({ saleId: id, reason }).strict())
        .max(10000)
        .refine((v) => new Set(v.map((x) => x.saleId)).size === v.length),
    })
    .strict(),
};
const bodyOptions = v2Kinds.map((kind) =>
  z
    .object({
      ...baseShape,
      kind: z.literal(kind),
      payload: payloadShapes[kind],
    })
    .strict(),
);
const auth = z
  .object({
    scheme: z.literal("ed25519"),
    grantId: id,
    signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
  })
  .strict();
// Each branch is strict, including its own discriminated payload schema.
export const v2OperationBodySchema = z.union(
  bodyOptions as [
    (typeof bodyOptions)[number],
    (typeof bodyOptions)[number],
    ...(typeof bodyOptions)[number][],
  ],
) as z.ZodType<V2OperationBody>;
const options = v2Kinds.map((kind) =>
  z
    .object({
      ...baseShape,
      kind: z.literal(kind),
      payload: payloadShapes[kind],
      canonicalDigest: digest,
      authenticity: auth,
    })
    .strict(),
);
export const v2OperationSchema = z.union(
  options as [
    (typeof options)[number],
    (typeof options)[number],
    ...(typeof options)[number][],
  ],
) as z.ZodType<V2Operation>;
export const v2ReceiptSchema = z
  .object({
    schemaVersion: z.literal(2),
    operationId: id,
    businessId: id,
    shiftId: id,
    authorityEpoch: positive,
    installationId: id,
    snapshotId: id,
    snapshotHash: digest,
    sequence: positive,
    canonicalDigest: digest,
    destination: z.enum(["peer", "cloud"]),
    receivedAt: z.string().datetime(),
    outcome: z.literal("committed"),
  })
  .strict();
const prepShape = {
  protocolVersion: z.literal(2),
  schemaVersion: z.literal(2),
  commandId: id,
  businessId: id,
  shiftId: id,
  snapshotId: id,
  snapshotHash: digest,
  installationId: id,
  authorityEpoch: positive,
  saleId: id,
  action: z.enum(["making", "done", "unprepared-return"]),
  occurredAt: z.string().datetime(),
};
export const v2PrepCommandBodySchema = z.object(prepShape).strict();
export const v2PrepCommandSchema = z
  .object({ ...prepShape, canonicalDigest: digest, authenticity: auth })
  .strict();
export const v2DraftSchema = z
  .object({
    id,
    businessId: id,
    shiftId: id,
    snapshotId: id,
    snapshotHash: digest,
    kind: z.enum(["packing", "opening", "cart"]),
    revision: positive,
    data: z
      .object({
        answers: z
          .array(
            z
              .object({
                entryId: id,
                templateVersion: positive,
                kind: z.enum([
                  "unchecked",
                  "packed",
                  "missing",
                  "authorized-exception",
                ]),
                actorId: id,
                at: z.string().datetime(),
                reason: reason.optional(),
                exceptionAuthorizationId: id.optional(),
              })
              .strict(),
          )
          .max(500)
          .refine(
            (v) => new Set(v.map((answer) => answer.entryId)).size === v.length,
          )
          .optional(),
        counts: z
          .array(v2CountSchema)
          .max(500)
          .refine(
            (v) => new Set(v.map((count) => count.itemId)).size === v.length,
          )
          .optional(),
        openingCashMinor: nonnegative.optional(),
        lines: z.array(v2LineSchema).max(100).optional(),
        text: z.string().max(4000).optional(),
        category: z.string().max(200).optional(),
        uncountedOnly: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();
