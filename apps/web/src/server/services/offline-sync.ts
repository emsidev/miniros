import { createHash, randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import {
  offlineShiftSessions,
  offlineSyncActions,
  cashDeductions,
  inventoryAdjustments,
  payments,
  sales,
  shifts,
} from "@miniros/db/schema";
import {
  offlineEnvelopeSchema,
  type OfflineEnvelope,
  type PreparedSnapshot,
  type SyncReply,
} from "@miniros/contracts";
import { and, eq } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import { lockShift, type PreparedOperationContext } from "./offline-context";
import { installationId, storageInstallationId } from "./offline-prepare";
import { startAssignedShift } from "./shift-start";
import { finalizeSale } from "./sales-operations";
import { submitCashDeduction } from "./cash-deduction-operations";
import { submitInventoryAdjustment } from "./inventory-adjustment-operations";
import { submitShiftCloseout } from "./shift-closeout";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export async function synchronizeOfflineAction(
  raw: unknown,
): Promise<SyncReply> {
  const envelope = offlineEnvelopeSchema.parse(raw);
  const access = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: envelope.operation.payload.shiftId,
  });
  const deviceId = await installationId();
  const storageId = await storageInstallationId();
  const digest = createHash("sha256")
    .update(canonicalJson(envelope))
    .digest("hex");
  return requireDatabase().transaction(async (tx): Promise<SyncReply> => {
    await lockShift(tx, access.business.id, envelope.operation.payload.shiftId);
    const [session] = await tx
      .select()
      .from(offlineShiftSessions)
      .where(
        and(
          eq(offlineShiftSessions.id, envelope.sessionId),
          eq(offlineShiftSessions.businessId, access.business.id),
        ),
      )
      .for("update")
      .limit(1);
    if (
      !session ||
      session.userId !== access.user.id ||
      session.deviceId !== deviceId ||
      session.shiftId !== envelope.operation.payload.shiftId ||
      session.snapshotId !== envelope.snapshotId ||
      (session.snapshot as PreparedSnapshot).storageInstallationId !== storageId
    )
      throw new AccessError(
        "The prepared device, account or shift no longer matches. Ask the owner to reconcile this device.",
      );
    const [previous] = await tx
      .select()
      .from(offlineSyncActions)
      .where(
        and(
          eq(offlineSyncActions.businessId, access.business.id),
          eq(offlineSyncActions.clientActionId, envelope.id),
        ),
      )
      .limit(1);
    if (previous) {
      if (
        previous.payloadDigest !== digest ||
        previous.sessionId !== session.id
      )
        return {
          ok: false,
          code: "CONFLICT",
          error:
            "This action ID already represents different work. Preserve the device and ask the owner to reconcile it.",
        };
      if (previous.status === "synced")
        return {
          ok: true,
          sequence: envelope.sequence,
          result: previous.result as Record<string, unknown>,
          sessionStatus: session.status as
            "closed" | "active" | "closing" | "prepared",
        };
    }
    const [occupiedSequence] = await tx
      .select({ clientActionId: offlineSyncActions.clientActionId })
      .from(offlineSyncActions)
      .where(
        and(
          eq(offlineSyncActions.sessionId, session.id),
          eq(offlineSyncActions.sequence, envelope.sequence),
        ),
      )
      .limit(1);
    if (occupiedSequence && occupiedSequence.clientActionId !== envelope.id)
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "This sequence already contains another original action. Reconcile it before continuing.",
      };
    if (["closed", "released", "recovery"].includes(session.status))
      return {
        ok: false,
        code: "CONFLICT",
        error: "This shift session is closed or awaiting owner recovery.",
      };
    if (envelope.sequence !== session.acknowledgedSequence + 1)
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "An earlier action is missing. Synchronize this device in order.",
      };
    const occurredAt = new Date(envelope.occurredAt);
    if (
      occurredAt.getTime() < session.createdAt.getTime() - 300000 ||
      occurredAt.getTime() > Date.now() + 300000 ||
      (session.lastOccurredAt && occurredAt < session.lastOccurredAt)
    )
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "The device clock or action order changed. Ask the owner to reconcile the recorded times.",
      };
    const snapshot = session.snapshot as PreparedSnapshot;
    const prepared: PreparedOperationContext = {
      tx,
      sessionId: session.id,
      snapshot,
      occurredAt,
    };
    const operation = envelope.operation;
    if (
      operation.type === "START_SHIFT"
        ? session.status !== "prepared" || envelope.sequence !== 1
        : !["active", "closing"].includes(session.status)
    )
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "Start the prepared shift before recording sales or closeout; opening counts can only be submitted once.",
      };
    if (
      session.closeoutIntent &&
      canonicalJson(session.closeoutIntent) !== canonicalJson(envelope)
    )
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "A closeout has sealed this shift. Its original counts must be reconciled first.",
      };
    if (
      operation.type === "START_SHIFT" &&
      operation.payload.inventoryLocationId !== snapshot.inventoryLocationId
    )
      throw new AccessError(
        "The opening inventory location does not match preparation.",
      );
    if (
      operation.type === "START_SHIFT" ||
      operation.type === "SUBMIT_CLOSEOUT"
    ) {
      const counts = operation.payload.counts;
      if (
        counts.length !== snapshot.inventory.length ||
        counts.some(
          (c) => !snapshot.inventory.some((i) => i.id === c.inventoryItemId),
        )
      )
        throw new AccessError(
          "Count every prepared inventory item exactly once.",
        );
    }
    if (
      operation.type === "CREATE_INVENTORY_ADJUSTMENT" &&
      !snapshot.inventory.some(
        (i) => i.id === operation.payload.inventoryItemId,
      )
    )
      throw new AccessError("This item was not prepared for the shift.");
    if (operation.type === "CREATE_SALE") {
      if (
        new Set(operation.proofs.map((p) => p.paymentId.toLowerCase())).size !==
          operation.proofs.length ||
        new Set(operation.proofs.map((p) => p.fileId.toLowerCase())).size !==
          operation.proofs.length ||
        operation.proofs.some(
          (proof) =>
            !operation.payload.payments.some(
              (payment) =>
                payment.id.toLowerCase() === proof.paymentId.toLowerCase() &&
                payment.paymentMethod !== "cash",
            ),
        )
      )
        throw new AccessError(
          "Payment proof declarations do not match this sale.",
        );
    }
    if (operation.type === "SUBMIT_CLOSEOUT") {
      await tx
        .update(offlineShiftSessions)
        .set({
          status: "closing",
          closeoutIntent: envelope,
          updatedAt: new Date(),
        })
        .where(eq(offlineShiftSessions.id, session.id));
      await tx
        .update(shifts)
        .set({ status: "closing" })
        .where(
          and(eq(shifts.id, session.shiftId), eq(shifts.status, "active")),
        );
      const [deductions, adjustments, saleActions] = await Promise.all([
        tx
          .select({ id: cashDeductions.id })
          .from(cashDeductions)
          .where(
            and(
              eq(cashDeductions.businessId, access.business.id),
              eq(cashDeductions.shiftId, session.shiftId),
              eq(cashDeductions.status, "pending"),
            ),
          ),
        tx
          .select({ id: inventoryAdjustments.id })
          .from(inventoryAdjustments)
          .where(
            and(
              eq(inventoryAdjustments.businessId, access.business.id),
              eq(inventoryAdjustments.shiftId, session.shiftId),
              eq(inventoryAdjustments.status, "pending"),
            ),
          ),
        tx
          .select({ payload: offlineSyncActions.payload })
          .from(offlineSyncActions)
          .where(
            and(
              eq(offlineSyncActions.sessionId, session.id),
              eq(offlineSyncActions.actionType, "CREATE_SALE"),
            ),
          ),
      ]);
      let waiting: SyncReply | undefined;
      if (deductions.length || adjustments.length)
        waiting = {
          ok: false,
          code: "WAITING_REVIEW",
          error:
            "Closeout is saved. An owner must review the pending cash and inventory requests before profit is final.",
        };
      for (const row of saleActions) {
        const sale = (row.payload as OfflineEnvelope).operation;
        if (sale.type !== "CREATE_SALE") continue;
        if (sale.discountProof) {
          const [record] = await tx
            .select({ fileId: sales.discountProofFileId })
            .from(sales)
            .where(
              and(
                eq(sales.businessId, access.business.id),
                eq(sales.id, sale.payload.saleId),
              ),
            )
            .limit(1);
          if (record?.fileId !== sale.discountProof.fileId.toLowerCase())
            waiting = {
              ok: false,
              code: "PROOF_PENDING",
              error:
                "Closeout is saved. Upload the pending promo photos from this device before finalizing.",
            };
        }
        for (const proof of sale.proofs) {
          const [payment] = await tx
            .select({ proofFileId: payments.proofFileId })
            .from(payments)
            .where(
              and(
                eq(payments.businessId, access.business.id),
                eq(payments.id, proof.paymentId),
              ),
            )
            .limit(1);
          if (payment?.proofFileId !== proof.fileId.toLowerCase())
            waiting = {
              ok: false,
              code: "PROOF_PENDING",
              error:
                "Closeout is saved. Upload the pending payment proofs from this device before finalizing.",
            };
        }
      }
      if (waiting) {
        await tx
          .update(offlineShiftSessions)
          .set({ lastError: waiting.ok ? null : waiting.error })
          .where(eq(offlineShiftSessions.id, session.id));
        return waiting;
      }
    }
    // Nested transaction is a savepoint: a domain failure leaves no partial effect.
    let result: Record<string, unknown>;
    try {
      result = await tx.transaction(async (inner) => {
        const context = { ...prepared, tx: inner };
        switch (operation.type) {
          case "START_SHIFT":
            return startAssignedShift(operation.payload, context);
          case "CREATE_SALE":
            return finalizeSale(operation.payload, context);
          case "CREATE_CASH_DEDUCTION":
            return submitCashDeduction(operation.payload, context);
          case "CREATE_INVENTORY_ADJUSTMENT":
            return submitInventoryAdjustment(operation.payload, context);
          case "SUBMIT_CLOSEOUT":
            return submitShiftCloseout(operation.payload, context);
        }
      });
    } catch (error) {
      const databaseCode =
        (error as { cause?: { code?: string }; code?: string }).cause?.code ??
        (error as { code?: string }).code;
      if (!(error instanceof AccessError) && !databaseCode?.match(/^(22|23)/))
        throw error;
      const message =
        error instanceof AccessError
          ? error.message
          : "The saved operation conflicts with an existing record or inventory constraint. Preserve this device for owner reconciliation.";
      await tx
        .update(offlineShiftSessions)
        .set({ lastError: message })
        .where(eq(offlineShiftSessions.id, session.id));
      await tx
        .insert(offlineSyncActions)
        .values({
          id: randomUUID(),
          businessId: access.business.id,
          shiftId: session.shiftId,
          sessionId: session.id,
          sequence: envelope.sequence,
          clientActionId: envelope.id,
          actionType: operation.type,
          status: "failed",
          payload: envelope,
          payloadDigest: digest,
          conflictCode: "CONFLICT",
          errorMessage: message,
          createdBy: access.user.id,
        })
        .onConflictDoNothing();
      return { ok: false, code: "CONFLICT", error: message };
    }
    if (result.idempotent === true)
      return {
        ok: false,
        code: "CONFLICT",
        error:
          "This operation’s record ID is already in use by another action. Preserve the original work for review.",
      };
    const status = operation.type === "SUBMIT_CLOSEOUT" ? "closed" : "active";
    await tx
      .insert(offlineSyncActions)
      .values({
        id: randomUUID(),
        businessId: access.business.id,
        shiftId: session.shiftId,
        sessionId: session.id,
        sequence: envelope.sequence,
        clientActionId: envelope.id,
        actionType: operation.type,
        status: "synced",
        payload: envelope,
        payloadDigest: digest,
        result,
        createdBy: access.user.id,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          offlineSyncActions.businessId,
          offlineSyncActions.clientActionId,
        ],
        set: {
          status: "synced",
          result,
          syncedAt: new Date(),
          conflictCode: null,
          errorMessage: null,
        },
      });
    await tx
      .update(offlineShiftSessions)
      .set({
        acknowledgedSequence: envelope.sequence,
        status,
        lastOccurredAt: occurredAt,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(offlineShiftSessions.id, session.id));
    return {
      ok: true,
      sequence: envelope.sequence,
      result,
      sessionStatus: status,
    };
  });
}
