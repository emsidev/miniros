import { createHash } from "node:crypto";
import { z } from "zod";
import { validateProofFile } from "@miniros/contracts";
import { requireDatabase } from "@miniros/db";
import { files, sales, shifts } from "@miniros/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createStorageAdmin } from "@/lib/supabase/storage-admin";
import { AccessError, requireActiveBusiness } from "./access";
import { assertProofDevice } from "./offline-context";
import {
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
  type OperationalTransaction,
} from "./operational-helpers";
import { hasExpectedSignature, safeObjectName } from "./proof-files";

export async function attachDiscountProof(input: {
  saleId: string;
  fileId: string;
  file: File;
}) {
  const access = await requireActiveBusiness({ employeePermission: "pos" });
  requireEmployee(access);
  const saleId = z.string().uuid().parse(input.saleId).toLowerCase();
  const fileId = z.string().uuid().parse(input.fileId).toLowerCase();
  if (!(input.file instanceof File))
    throw new AccessError("A discount photo is required.");
  const error = validateProofFile(input.file, true);
  if (error) throw new AccessError(error);
  if (!(await hasExpectedSignature(input.file)))
    throw new AccessError("The photo content does not match its file type.");
  const bucket = "payment-proofs";
  const digest = createHash("sha256")
    .update(Buffer.from(await input.file.arrayBuffer()))
    .digest("hex");
  const objectPath = `${access.business.id}/discounts/${saleId}/${digest}/${safeObjectName(fileId, input.file.name)}`;
  const database = requireDatabase();

  async function authorize(tx: OperationalTransaction) {
    const [sale] = await tx
      .select({
        id: sales.id,
        shiftId: sales.shiftId,
        proofFileId: sales.discountProofFileId,
        requestedFileId: sales.discountProofRequestId,
        shiftStatus: shifts.status,
      })
      .from(sales)
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, sales.shiftId),
          eq(shifts.businessId, sales.businessId),
        ),
      )
      .where(
        and(
          eq(sales.id, saleId),
          eq(sales.businessId, access.business.id),
          eq(sales.status, "completed"),
          isNull(shifts.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!sale || sale.requestedFileId !== fileId)
      throw new AccessError(
        "This photo does not match the sale's required promo proof.",
      );
    await assertProofDevice(
      tx,
      access.business.id,
      sale.shiftId,
      access.user.id,
    );
    await requireCurrentAssignment(
      tx,
      access.business.id,
      sale.shiftId,
      access.employee!.id,
      Boolean(sale.proofFileId),
    );
    if (sale.proofFileId) {
      const [file] = await tx
        .select({ objectPath: files.objectPath })
        .from(files)
        .where(
          and(
            eq(files.id, sale.proofFileId),
            eq(files.businessId, access.business.id),
            eq(files.bucketId, bucket),
          ),
        )
        .limit(1);
      if (sale.proofFileId !== fileId || file?.objectPath !== objectPath)
        throw new AccessError(
          "This sale already has a different discount photo.",
        );
    } else if (sale.shiftStatus !== "active" && sale.shiftStatus !== "closing")
      throw new AccessError("Photo upload is closed for this shift.");
    return sale;
  }
  const preflight = await database.transaction(authorize);
  if (preflight.proofFileId) return { saleId, fileId, idempotent: true };
  const storage = createStorageAdmin().storage.from(bucket);
  const { error: uploadError } = await storage.upload(objectPath, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (uploadError) {
    const { data } = await storage.download(objectPath);
    if (
      !data ||
      createHash("sha256")
        .update(Buffer.from(await data.arrayBuffer()))
        .digest("hex") !== digest
    )
      throw new AccessError(
        "The discount photo could not be uploaded. Its local copy is retained for retry.",
      );
  }
  await database.transaction(async (tx) => {
    const sale = await authorize(tx);
    if (sale.proofFileId) return;
    await tx.insert(files).values({
      id: fileId,
      businessId: access.business.id,
      bucketId: bucket,
      objectPath,
      fileType: "other",
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      uploadedBy: access.user.id,
    });
    await tx
      .update(sales)
      .set({ discountProofFileId: fileId, updatedAt: new Date() })
      .where(
        and(
          eq(sales.id, saleId),
          eq(sales.businessId, access.business.id),
          isNull(sales.discountProofFileId),
        ),
      );
    await insertAuditLog(tx, access, {
      action: "sale.discount_photo_attached",
      entityType: "sale",
      entityId: saleId,
      shiftId: sale.shiftId,
      metadata: { fileId, objectPath },
    });
  });
  return { saleId, fileId, idempotent: false };
}
