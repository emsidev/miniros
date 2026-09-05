import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { ShiftStore, savePreparedShift } from "./store";
import {
  loadOpeningDraft,
  saveOpeningDraft,
  submitPreparedOpening,
} from "./opening-draft";
import { preparedFixture, uuid } from "@/test/offline-fixture";
import { requestedShiftId, resolveSavedSession } from "./resolve-session";

const databases: ShiftStore[] = [];
async function fixture() {
  const prepared = preparedFixture();
  const db = new ShiftStore(uuid());
  databases.push(db);
  await db.meta.put({
    id: "storageInstallationId",
    value: prepared.snapshot.storageInstallationId,
  });
  await savePreparedShift(
    prepared,
    {
      userId: prepared.snapshot.userId,
      businessId: prepared.snapshot.businessId,
      deviceId: prepared.deviceId,
    },
    db,
  );
  const session = (await db.sessions.get(prepared.id))!;
  return { db, session };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});

describe("automatic shift opening", () => {
  it("recovers counts, expressions, notes and review step after a cold reopen", async () => {
    const { db, session } = await fixture();
    const draft = {
      ...(await loadOpeningDraft(session.id, db)),
      counts: { [session.snapshot.inventory[0]!.id]: "6 + 4" },
      notes: "Opening delivery checked",
      step: 1,
    };
    await saveOpeningDraft(session.id, draft, db);
    db.close();
    await db.open();
    expect(await loadOpeningDraft(session.id, db)).toEqual(draft);
    await submitPreparedOpening(session, draft, db);
    expect(
      (await db.sessions.get(session.id))?.projection.balances[
        session.snapshot.inventory[0]!.id
      ],
    ).toBe("10");
    expect(await db.drafts.get(`counts:${session.id}:start`)).toBeUndefined();
    await saveOpeningDraft(session.id, draft, db);
    expect(await db.drafts.get(`counts:${session.id}:start`)).toBeUndefined();
  });
  it("deduplicates a double submit and shares opening IDs across tabs", async () => {
    const { db, session } = await fixture();
    const second = new ShiftStore(db.name);
    try {
      const [firstDraft, secondDraft] = await Promise.all([
        loadOpeningDraft(session.id, db),
        loadOpeningDraft(session.id, second),
      ]);
      expect(firstDraft.actionId).toBe(secondDraft.actionId);
      const draft = {
        ...firstDraft,
        counts: { [session.snapshot.inventory[0]!.id]: "10" },
      };
      const [a, b] = await Promise.all([
        submitPreparedOpening(session, draft, db),
        submitPreparedOpening(session, draft, second),
      ]);
      expect(a.id).toBe(b.id);
      expect(await db.shiftActions.count()).toBe(1);
      await expect(
        submitPreparedOpening(
          session,
          { ...draft, counts: { [session.snapshot.inventory[0]!.id]: "11" } },
          db,
        ),
      ).rejects.toThrow("different work");
    } finally {
      second.close();
    }
  });
  it("retains drafts and rolls back when the opening transaction cannot commit", async () => {
    const { db, session } = await fixture();
    const draft = {
      ...(await loadOpeningDraft(session.id, db)),
      counts: { [session.snapshot.inventory[0]!.id]: "10" },
    };
    await saveOpeningDraft(session.id, draft, db);
    const fail = () => {
      throw new Error("Quota exceeded");
    };
    db.shiftActions.hook("creating", fail);
    await expect(submitPreparedOpening(session, draft, db)).rejects.toThrow(
      "Quota exceeded",
    );
    expect((await db.sessions.get(session.id))?.projection.state).toBe(
      "prepared",
    );
    expect(await loadOpeningDraft(session.id, db)).toEqual(draft);
    db.shiftActions.hook("creating").unsubscribe(fail);
    await submitPreparedOpening(session, draft, db);
    expect(await db.shiftActions.count()).toBe(1);
  });
  it("keeps legacy draft entries and protects them from a different account", async () => {
    const { db, session } = await fixture();
    await db.drafts.put({
      id: `counts:${session.id}:start`,
      value: {
        counts: { [session.snapshot.inventory[0]!.id]: "8" },
        notes: "Legacy notes",
        cash: "",
      },
    });
    expect(await loadOpeningDraft(session.id, db)).toMatchObject({
      notes: "Legacy notes",
      actionId: expect.any(String),
    });
    await db.meta.delete("identity");
    await expect(loadOpeningDraft(session.id, db)).rejects.toThrow("Sign in");
    expect(await db.drafts.count()).toBe(1);
  });
  it("resolves an offline operational URL without substituting another saved shift", async () => {
    const { session } = await fixture();
    const params = new URLSearchParams();
    const shiftId = requestedShiftId(
      `/shifts/${session.snapshot.shiftId}/start`,
      params,
    );
    expect(resolveSavedSession([session], undefined, shiftId)).toBe(session);
    expect(resolveSavedSession([session], uuid())).toBeUndefined();
    expect(resolveSavedSession([session], undefined, uuid())).toBeUndefined();
    expect(resolveSavedSession([session], session.id, uuid())).toBeUndefined();
    expect(
      resolveSavedSession(
        [session],
        undefined,
        requestedShiftId("/shifts/not-saved/start", params),
      ),
    ).toBeUndefined();
    expect(resolveSavedSession([session])).toBe(session);
  });
});
