import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireDatabase } from "@miniros/db";
import { files, payments, sales, shifts } from "@miniros/db/schema";
import { and, eq, isNull } from "drizzle-orm";

import { getSupabaseSecretEnv } from "@/lib/env";
import { AccessError, requireActiveBusiness } from "./access";
import {
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
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

function safeObjectName(fileId: string, originalName: string) {
  const cleaned = originalName
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 96);
  return `${fileId}-${cleaned || "proof"}`;
}

async function hasExpectedSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  switch (file.type) {
    case "application/pdf":
      return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/webp":
      return (
        startsWith(0x52, 0x49, 0x46, 0x46) &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

function createStorageAdmin() {
  const { url, secretKey } = getSupabaseSecretEnv();
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function removeUploadedObject(
  admin: ReturnType<typeof createStorageAdmin>,
  objectPath: string,
) {
  try {
    const { error } = await admin.storage
      .from(PAYMENT_PROOF_BUCKET)
      .remove([objectPath]);
    if (error) console.error("Payment proof cleanup failed", error);
  } catch (error) {
    console.error("Payment proof cleanup could not run", error);
  }
}

export async function attachPaymentProof(input: AttachPaymentProofInput) {
  const access = await requireActiveBusiness({ employeePermission: "pos" });
  requireEmployee(access);
  if (!UUID_PATTERN.test(input.paymentId) || !UUID_PATTERN.test(input.fileId)) {
    throw new AccessError("Payment and file IDs must be valid UUIDs.");
  }
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
  const objectPath = `${access.business.id}/payments/${input.paymentId}/${safeObjectName(input.fileId, input.file.name)}`;
  const preflight = await database.transaction(async (tx) => {
    const [payment] = await tx
      .select({
        id: payments.id,
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
          eq(payments.id, input.paymentId),
          eq(payments.businessId, access.business.id),
          eq(payments.status, "completed"),
          isNull(shifts.deletedAt),
        ),
      )
      .limit(1);

    if (!payment || payment.paymentMethod === "cash") {
      throw new AccessError("An eligible non-cash payment was not found.");
    }
    if (payment.shiftStatus !== "active" && payment.shiftStatus !== "closing") {
      throw new AccessError("Payment proof upload is closed for this shift.");
    }
    await requireCurrentAssignment(
      tx,
      access.business.id,
      payment.shiftId,
      access.employee.id,
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
    if (
      existingFile?.id === input.fileId &&
      existingFile.objectPath === objectPath
    ) {
      return { shiftId: payment.shiftId, existing: true as const };
    }
    throw new AccessError("This payment already has a proof file.");
  });

  if ("existing" in preflight) {
    return {
      paymentId: input.paymentId,
      fileId: input.fileId,
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
    console.error("Payment proof upload failed", uploadError);
    throw new AccessError("The payment proof could not be uploaded.");
  }

  try {
    await database.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: payments.id,
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
            eq(payments.id, input.paymentId),
            eq(payments.businessId, access.business.id),
            eq(payments.status, "completed"),
            isNull(shifts.deletedAt),
          ),
        )
        .for("update")
        .limit(1);

      if (
        !payment ||
        payment.paymentMethod === "cash" ||
        payment.proofFileId ||
        (payment.shiftStatus !== "active" && payment.shiftStatus !== "closing")
      ) {
        throw new AccessError("The payment is no longer eligible for proof.");
      }
      await requireCurrentAssignment(
        tx,
        access.business.id,
        payment.shiftId,
        access.employee.id,
      );

      await tx.insert(files).values({
        id: input.fileId,
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
        .set({ proofFileId: input.fileId })
        .where(
          and(
            eq(payments.id, input.paymentId),
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
        entityId: input.paymentId,
        shiftId: payment.shiftId,
        metadata: {
          fileId: input.fileId,
          bucketId: PAYMENT_PROOF_BUCKET,
          objectPath,
          mimeType: input.file.type,
          sizeBytes: input.file.size,
        },
      });
    });
  } catch (error) {
    await removeUploadedObject(storageAdmin, objectPath);
    throw error;
  }

  return {
    paymentId: input.paymentId,
    fileId: input.fileId,
    objectPath,
    idempotent: false,
  };
}
