import { safeObjectName, hasExpectedSignature } from "./proof-files";
import { createHash } from "node:crypto";
import { assertProofDevice } from "./offline-context";
import { requireDatabase } from "@miniros/db";
import {
  files,
  offlineSyncActions,
  payments,
  sales,
  shifts,
} from "@miniros/db/schema";
import type { OfflineEnvelope } from "@miniros/contracts";
import { and, eq, isNull, sql } from "drizzle-orm";

import { createStorageAdmin } from "@/lib/supabase/storage-admin";
import { AccessError, requireActiveBusiness } from "./access";
import {
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
  type OperationalTransaction,
} from "./operational-helpers";

const PAYMENT_PROOF_BUCKET = "payment-proofs";
const MAX_PAYMENT_PROOF_BYTES = 3_500_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_PROOF_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type AttachPaymentProofInput = {
  paymentId: string;
  fileId: string;
  file: File;
};

export async function attachPaymentProof(input: AttachPaymentProofInput) {
  const access = await requireActiveBusiness({ employeePermission: "pos" });
  requireEmployee(access);
  if (!UUID_PATTERN.test(input.paymentId) || !UUID_PATTERN.test(input.fileId)) {
    throw new AccessError("Payment and file IDs must be valid UUIDs.");
  }
  const paymentId = input.paymentId.toLowerCase();
  const fileId = input.fileId.toLowerCase();
  if (!(input.file instanceof File)) {
    throw new AccessError("A payment proof file is required.");
  }
  if (input.file.size <= 0 || input.file.size > MAX_PAYMENT_PROOF_BYTES) {
    throw new AccessError("Payment proof files must be no larger than 3.5 MB.");
  }
  if (!PAYMENT_PROOF_MIME_TYPES.has(input.file.type)) {
    throw new AccessError("Use a JPEG, PNG, WebP, or PDF payment proof.");
  }
  if (!(await hasExpectedSignature(input.file))) {
    throw new AccessError("The payment proof content does not match its type.");
  }

  const database = requireDatabase();
  const contentDigest = createHash("sha256")
    .update(Buffer.from(await input.file.arrayBuffer()))
    .digest("hex");
  const objectPath = `${access.business.id}/payments/${paymentId}/${contentDigest}/${safeObjectName(fileId, input.file.name)}`;
  async function authorize(tx: OperationalTransaction) {
    const [payment] = await tx
      .select({
        id: payments.id,
        saleId: payments.saleId,
        paymentMethod: payments.paymentMethod,
        proofFileId: payments.proofFileId,
        shiftId: sales.shiftId,
        shiftStatus: shifts.status,
      })
      .from(payments)
      .innerJoin(
        sales,
        and(
          eq(sales.id, payments.saleId),
          eq(sales.businessId, payments.businessId),
        ),
      )
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, sales.shiftId),
          eq(shifts.businessId, sales.businessId),
        ),
      )
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.businessId, access.business.id),
          eq(payments.status, "completed"),
          isNull(shifts.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!payment || payment.paymentMethod === "cash") {
      throw new AccessError("An eligible non-cash payment was not found.");
    }
    const session = await assertProofDevice(
      tx,
      access.business.id,
      payment.shiftId,
      access.user.id,
    );
    if (session) {
      const [record] = await tx
        .select({ payload: offlineSyncActions.payload })
        .from(offlineSyncActions)
        .where(
          and(
            eq(offlineSyncActions.businessId, access.business.id),
            eq(offlineSyncActions.sessionId, session.id),
            eq(offlineSyncActions.actionType, "CREATE_SALE"),
            eq(offlineSyncActions.status, "synced"),
            sql`(${offlineSyncActions.payload} #>> '{operation,payload,saleId}')::uuid = ${payment.saleId}::uuid`,
          ),
        )
        .limit(1);
      const operation = (record?.payload as OfflineEnvelope | undefined)
        ?.operation;
      const declared =
        operation?.type === "CREATE_SALE"
          ? operation.proofs.find(
              (proof) => proof.paymentId.toLowerCase() === paymentId,
            )
          : undefined;
      if (declared && declared.fileId.toLowerCase() !== fileId)
        throw new AccessError(
          "This payment requires the proof file declared by its original offline sale.",
        );
    }
    if (
      !payment.proofFileId &&
      payment.shiftStatus !== "active" &&
      payment.shiftStatus !== "closing"
    ) {
      throw new AccessError("Payment proof upload is closed for this shift.");
    }
    await requireCurrentAssignment(
      tx,
      access.business.id,
      payment.shiftId,
      access.employee.id,
      Boolean(payment.proofFileId),
    );

    if (!payment.proofFileId) return { shiftId: payment.shiftId };
    const [existingFile] = await tx
      .select({ id: files.id, objectPath: files.objectPath })
      .from(files)
      .where(
        and(
          eq(files.id, payment.proofFileId),
          eq(files.businessId, access.business.id),
          eq(files.bucketId, PAYMENT_PROOF_BUCKET),
        ),
      )
      .limit(1);
    if (existingFile?.id === fileId && existingFile.objectPath === objectPath) {
      return { shiftId: payment.shiftId, existing: true as const };
    }
    throw new AccessError("This payment already has a different proof file.");
  }

  const preflight = await database.transaction(authorize);

  if ("existing" in preflight) {
    return {
      paymentId: paymentId,
      fileId: fileId,
      objectPath,
      idempotent: true,
    };
  }

  const storageAdmin = createStorageAdmin();
  const { error: uploadError } = await storageAdmin.storage
    .from(PAYMENT_PROOF_BUCKET)
    .upload(objectPath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type,
      upsert: false,
    });
  if (uploadError) {
    // An upload may have succeeded before the browser lost its acknowledgement.
    // Content-addressed paths make retry safe without overwriting another proof.
    const { data: stored } = await storageAdmin.storage
      .from(PAYMENT_PROOF_BUCKET)
      .download(objectPath);
    if (
      !stored ||
      createHash("sha256")
        .update(Buffer.from(await stored.arrayBuffer()))
        .digest("hex") !== contentDigest
    )
      throw new AccessError(
        "The payment proof could not be uploaded. Its local copy is retained for retry.",
      );
  }

  await database.transaction(async (tx) => {
    const payment = await authorize(tx);
    if ("existing" in payment) return;

    await tx.insert(files).values({
      id: fileId,
      businessId: access.business.id,
      bucketId: PAYMENT_PROOF_BUCKET,
      objectPath,
      fileType: "payment_proof",
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      uploadedBy: access.user.id,
    });
    const [updated] = await tx
      .update(payments)
      .set({ proofFileId: fileId })
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.businessId, access.business.id),
          isNull(payments.proofFileId),
        ),
      )
      .returning({ id: payments.id });
    if (!updated) {
      throw new AccessError("The payment proof could not be linked.");
    }

    await insertAuditLog(tx, access, {
      action: "payment.proof_attached",
      entityType: "payment",
      entityId: paymentId,
      shiftId: payment.shiftId,
      metadata: {
        fileId: fileId,
        bucketId: PAYMENT_PROOF_BUCKET,
        objectPath,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
      },
    });
  });

  return {
    paymentId: paymentId,
    fileId: fileId,
    objectPath,
    idempotent: false,
  };
}
