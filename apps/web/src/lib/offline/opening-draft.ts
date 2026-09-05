import { countsPayload } from "@/components/employee/count-model";
import {
  appendShiftAction,
  cachedIdentity,
  shiftStore,
  type LocalSession,
  type ShiftStore,
} from "./store";

export type OpeningDraft = {
  counts: Record<string, string>;
  notes: string;
  step: number;
  actionId: string;
  openingEventId: string;
};

async function requireLocalSession(sessionId: string, db: ShiftStore) {
  const [identity, session] = await Promise.all([
    cachedIdentity(db),
    db.sessions.get(sessionId),
  ]);
  if (
    !identity ||
    !session ||
    session.snapshot.userId !== identity.userId ||
    session.snapshot.businessId !== identity.businessId ||
    session.deviceId !== identity.deviceId
  )
    throw new Error("Sign in to the account that saved this shift.");
  return session;
}

export async function loadOpeningDraft(
  sessionId: string,
  db = shiftStore(),
): Promise<OpeningDraft> {
  return db.transaction("rw", db.sessions, db.meta, db.drafts, async () => {
    await requireLocalSession(sessionId, db);
    const key = `counts:${sessionId}:start`;
    const saved = (await db.drafts.get(key))?.value as
      Partial<OpeningDraft> | undefined;
    const draft: OpeningDraft = {
      counts: saved?.counts ?? {},
      notes: saved?.notes ?? "",
      step: saved?.step === 1 ? 1 : 0,
      actionId: saved?.actionId ?? crypto.randomUUID(),
      openingEventId: saved?.openingEventId ?? crypto.randomUUID(),
    };
    await db.drafts.put({ id: key, value: draft });
    return draft;
  });
}

export async function saveOpeningDraft(
  sessionId: string,
  draft: OpeningDraft,
  db = shiftStore(),
) {
  await db.transaction("rw", db.sessions, db.meta, db.drafts, async () => {
    const session = await requireLocalSession(sessionId, db);
    // A late render/tab must not recreate a draft after the start commits.
    if (session.projection.state !== "prepared") return;
    await db.drafts.put({ id: `counts:${sessionId}:start`, value: draft });
  });
}

export async function submitPreparedOpening(
  session: LocalSession,
  draft: OpeningDraft,
  db = shiftStore(),
) {
  const items = session.snapshot.inventory.map((item) => ({
    ...item,
    initialQuantity: "",
  }));
  return appendShiftAction(
    session.id,
    {
      type: "START_SHIFT",
      payload: {
        shiftId: session.snapshot.shiftId,
        inventoryLocationId: session.snapshot.inventoryLocationId,
        openingEventId: draft.openingEventId,
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
