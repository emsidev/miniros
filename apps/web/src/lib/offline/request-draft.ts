import { offlineOperationSchema } from "@miniros/contracts";
import { numericExpressionToNumber } from "@/lib/numeric-expression";
import { requireLocalSession } from "./opening-draft";
import { appendShiftAction, shiftStore } from "./store";

export type RequestDraft = {
  actionId: string;
  eventId: string;
  label: string;
  item: string;
  amount: string;
  reason: string;
};
export async function loadRequestDraft(
  sessionId: string,
  kind: "cash" | "inventory",
  db = shiftStore(),
): Promise<RequestDraft> {
  return db.transaction("rw", db.sessions, db.meta, db.drafts, async () => {
    await requireLocalSession(sessionId, db);
    const key = `request:${sessionId}:${kind}`;
    const row = await db.drafts.get(key);
    const draft = (row?.value as RequestDraft | undefined) ?? {
      actionId: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
      label: "",
      item: "",
      amount: "",
      reason: "",
    };
    await db.drafts.put({ id: key, value: draft });
    return draft;
  });
}
export async function saveRequestDraft(
  sessionId: string,
  kind: "cash" | "inventory",
  draft: RequestDraft,
  db = shiftStore(),
) {
  await db.transaction("rw", db.sessions, db.meta, db.drafts, async () => {
    const session = await requireLocalSession(sessionId, db);
    if (session.projection.state !== "active")
      throw new Error("This shift is no longer selling.");
    await db.drafts.put({ id: `request:${sessionId}:${kind}`, value: draft });
  });
}
export async function submitRequestDraft(
  sessionId: string,
  shiftId: string,
  kind: "cash" | "inventory",
  draft: RequestDraft,
  db = shiftStore(),
) {
  if (!draft.amount.trim()) throw new Error("Enter the actual amount.");
  const amount = numericExpressionToNumber(draft.amount);
  const operation = offlineOperationSchema.parse(
    kind === "cash"
      ? {
          type: "CREATE_CASH_DEDUCTION",
          payload: {
            deductionId: draft.actionId,
            shiftId,
            label: draft.label.trim(),
            amountCents: Math.round(amount * 100),
            reason: draft.reason.trim(),
          },
        }
      : {
          type: "CREATE_INVENTORY_ADJUSTMENT",
          payload: {
            adjustmentId: draft.actionId,
            inventoryEventId: draft.eventId,
            shiftId,
            inventoryItemId: draft.item,
            quantityDelta: String(amount),
            reason: draft.reason.trim(),
          },
        },
  );
  return appendShiftAction(sessionId, operation, draft.actionId, [], db);
}
