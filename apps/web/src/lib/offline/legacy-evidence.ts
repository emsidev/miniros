import {
  uploadPaymentProofAction,
  uploadDiscountProofAction,
} from "@/server/actions/operations";
import {
  cachedIdentity,
  offlineChanged,
  shiftStore,
  type LocalIdentity,
} from "./store";
import type { SaleReceipt } from "@/app/(workspace)/pos/pos-types";
export type LegacyEvidence = {
  id: string;
  userId: string;
  businessId: string;
  shiftId: string;
  fileId: string;
  saleId?: string;
  paymentId?: string;
  file: File;
  error?: string;
};
export async function handOffLegacyEvidence(
  receipt: SaleReceipt,
  shiftId: string,
  draftKey: string,
  advance = true,
) {
  const db = shiftStore(),
    identity = await cachedIdentity();
  if (!identity)
    throw new Error(
      "Sign in to the original account before recovering attachments.",
    );
  const rows: LegacyEvidence[] = receipt.pendingProofs.map((payment) => {
    if (!payment.file)
      throw new Error(
        "An original payment photo is missing. Keep this checkout for recovery.",
      );
    return {
      ...identity,
      id: `attachment:${identity.businessId}:${identity.userId}:${payment.proofFileId}`,
      shiftId,
      fileId: payment.proofFileId,
      paymentId: payment.id,
      file: payment.file,
    };
  });
  if (receipt.pendingDiscountProof) {
    if (!receipt.discountPhoto?.file)
      throw new Error("The original discount photo is missing.");
    rows.push({
      ...identity,
      id: `attachment:${identity.businessId}:${identity.userId}:${receipt.discountPhoto.fileId}`,
      shiftId,
      fileId: receipt.discountPhoto.fileId,
      saleId: receipt.saleId,
      file: receipt.discountPhoto.file,
    });
  }
  await db.transaction("rw", db.meta, db.drafts, async () => {
    const current = await cachedIdentity(db);
    if (
      current?.businessId !== identity.businessId ||
      current.userId !== identity.userId
    )
      throw new Error("The account changed.");
    for (const row of rows) await db.drafts.put({ id: row.id, value: row });
    if (advance) await db.drafts.delete(draftKey);
    else {
      const previous = await db.drafts.get(draftKey);
      await db.drafts.put({
        id: draftKey,
        value: {
          ...((previous?.value as object) ?? {}),
          receipt: {
            ...receipt,
            pendingProofs: [],
            pendingDiscountProof: false,
          },
        },
      });
    }
  });
  offlineChanged();
}
export async function pendingLegacyEvidence(identity?: LocalIdentity) {
  identity ??= await cachedIdentity();
  if (!identity) return [];
  return (
    await shiftStore()
      .drafts.filter((row) =>
        row.id.startsWith(
          `attachment:${identity.businessId}:${identity.userId}:`,
        ),
      )
      .toArray()
  ).map((row) => row.value as LegacyEvidence);
}
export async function retryLegacyEvidence() {
  if (!navigator.onLine) return;
  for (const row of await pendingLegacyEvidence()) {
    const current = await cachedIdentity();
    if (current?.businessId !== row.businessId || current.userId !== row.userId)
      return;
    const form = new FormData();
    form.set("fileId", row.fileId);
    form.set("file", row.file);
    if (row.saleId) form.set("saleId", row.saleId);
    else form.set("paymentId", row.paymentId!);
    try {
      const result = row.saleId
        ? await uploadDiscountProofAction(form)
        : await uploadPaymentProofAction(form);
      if (!result.ok) throw new Error(result.error);
      await shiftStore().drafts.delete(row.id);
    } catch (failure) {
      await shiftStore().drafts.put({
        id: row.id,
        value: {
          ...row,
          error:
            failure instanceof Error
              ? failure.message
              : "Attachment upload interrupted.",
        },
      });
    }
  }
  offlineChanged();
}
