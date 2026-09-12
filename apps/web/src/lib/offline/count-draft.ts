import {
  countsPayload,
  validateCash,
  validateCounts,
} from "@/components/employee/count-model";
import { numericExpressionToNumber } from "@/lib/numeric-expression";
import { requireLocalSession, type OpeningDraft } from "./opening-draft";
import { appendShiftAction, shiftStore, type LocalSession } from "./store";

export type ClosingDraft = OpeningDraft & {
  cashReconciliationId: string;
  profitSummaryId: string;
  inventoryEventId: string;
};
export async function loadClosingDraft(
  sessionId: string,
  db = shiftStore(),
): Promise<ClosingDraft> {
  return db.transaction("rw", db.sessions, db.meta, db.drafts, async () => {
    await requireLocalSession(sessionId, db);
    const key = `counts:${sessionId}:close`;
    const saved = (await db.drafts.get(key))?.value as
      Partial<ClosingDraft> | undefined;
    const draft: ClosingDraft = {
      counts: saved?.counts ?? {},
      cash: saved?.cash ?? "",
      notes: saved?.notes ?? "",
      step: Math.min(2, Math.max(0, saved?.step ?? 0)),
      query: saved?.query ?? "",
      category: saved?.category ?? "all",
      uncounted: saved?.uncounted ?? false,
      actionId: saved?.actionId ?? crypto.randomUUID(),
      openingEventId: saved?.openingEventId ?? crypto.randomUUID(),
      cashReconciliationId: saved?.cashReconciliationId ?? crypto.randomUUID(),
      profitSummaryId: saved?.profitSummaryId ?? crypto.randomUUID(),
      inventoryEventId: saved?.inventoryEventId ?? crypto.randomUUID(),
    };
    await db.drafts.put({ id: key, value: draft });
    return draft;
  });
}
export async function saveClosingDraft(
  sessionId: string,
  draft: ClosingDraft,
  db = shiftStore(),
) {
  await db.transaction("rw", db.sessions, db.meta, db.drafts, async () => {
    const session = await requireLocalSession(sessionId, db);
    if (session.projection.state !== "active") return;
    await db.drafts.put({ id: `counts:${sessionId}:close`, value: draft });
  });
}
export async function submitPreparedClosing(
  session: LocalSession,
  draft: ClosingDraft,
  db = shiftStore(),
) {
  const items = session.snapshot.inventory.map((item) => ({
    ...item,
    initialQuantity: session.projection.balances[item.id] ?? "0",
  }));
  if (
    validateCounts(items, draft.counts).length ||
    validateCash(draft.cash ?? "").length
  )
    throw new Error(
      "Count every stock item and the actual cash before closing.",
    );
  return appendShiftAction(
    session.id,
    {
      type: "SUBMIT_CLOSEOUT",
      payload: {
        shiftId: session.snapshot.shiftId,
        closeoutId: draft.actionId,
        cashReconciliationId: draft.cashReconciliationId,
        profitSummaryId: draft.profitSummaryId,
        inventoryEventId: draft.inventoryEventId,
        actualCashCents: Math.round(
          numericExpressionToNumber(draft.cash ?? "") * 100,
        ),
        counts: countsPayload(items, draft.counts).map((count) => ({
          ...count,
          quantity: Number(count.quantity),
        })),
        notes: draft.notes,
      },
    },
    draft.actionId,
    [],
    db,
  );
}
