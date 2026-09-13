import Dexie, { type Table } from "dexie";
import {
  cachedIdentity,
  offlineChanged,
  shiftStore,
  visibleSessions,
} from "./offline/store";

type DraftRow = { id: string; value: unknown };
class PosDraftStore extends Dexie {
  drafts!: Table<DraftRow, string>;
  constructor(name = "miniros-pos-drafts") {
    super(name);
    this.version(1).stores({ drafts: "&id" });
  }
}
let instance: PosDraftStore | undefined;
export const posDraftStore = () => (instance ??= new PosDraftStore());

function filesIn(value: unknown): File[] {
  if (typeof File !== "undefined" && value instanceof File) return [value];
  if (Array.isArray(value)) return value.flatMap(filesIn);
  return value && typeof value === "object"
    ? Object.values(value).flatMap(filesIn)
    : [];
}
async function verifyCopy(source: unknown, copy: unknown) {
  if (JSON.stringify(source) !== JSON.stringify(copy))
    throw new Error("Saved checkout migration verification failed.");
  const originals = filesIn(source),
    imported = filesIn(copy);
  if (originals.length !== imported.length)
    throw new Error("Saved photos could not be imported.");
  for (let i = 0; i < originals.length; i++) {
    const a = originals[i]!,
      b = imported[i]!;
    const aBytes = new Uint8Array(await a.arrayBuffer()),
      bBytes = new Uint8Array(await b.arrayBuffer());
    if (
      a.name !== b.name ||
      a.type !== b.type ||
      a.size !== b.size ||
      aBytes.some((byte, index) => byte !== bBytes[index])
    )
      throw new Error(
        "Saved photo verification failed. The original is retained.",
      );
  }
}
export async function migrateLegacyCheckouts() {
  const old = posDraftStore(),
    db = shiftStore();
  for (const row of await old.drafts.toArray()) {
    const marker = "legacy-pos-import:" + row.id;
    if (await db.meta.get(marker)) continue;
    const existing = await db.drafts.get(row.id);
    if (
      existing &&
      JSON.stringify(existing.value) !== JSON.stringify(row.value)
    )
      throw new Error(
        "Two saved checkouts need recovery. Neither was overwritten.",
      );
    if (!existing) await db.drafts.add(row);
    await verifyCopy(row.value, (await db.drafts.get(row.id))?.value);
    await db.meta.put({
      id: marker,
      value: { target: row.id, verified: true },
    });
    // Keep originals. Markers prevent a completed cart from being resurrected.
  }
}
export async function loadCheckoutDraft(
  sessionId: string,
  ownerKey: string,
  shiftId: string,
) {
  await migrateLegacyCheckouts();
  const db = shiftStore(),
    target = "pos:" + sessionId;
  const original = "pos:" + ownerKey + ":" + shiftId;
  const marker = "legacy-shift-import:" + original;
  if (!(await db.meta.get(marker))) {
    const source = await db.drafts.get(original),
      current = await db.drafts.get(target);
    if (source) {
      if (
        current &&
        JSON.stringify(current.value) !== JSON.stringify(source.value)
      )
        throw new Error(
          "Two checkouts exist for this shift. Keep this device and ask the owner to recover them.",
        );
      if (!current) await db.drafts.add({ id: target, value: source.value });
      await verifyCopy(source.value, (await db.drafts.get(target))?.value);
      await db.meta.put({ id: marker, value: { target, verified: true } });
    }
  }
  return db.drafts.get(target);
}
export async function guardSavedCheckoutExit() {
  await migrateLegacyCheckouts();
  const db = shiftStore(),
    sessions = await visibleSessions(),
    identity = await cachedIdentity();
  if (
    sessions.some(
      (s) =>
        ((s.projection.state === "active" ||
          s.projection.state === "closing") &&
          s.status !== "closed") ||
        s.nextSequence - 1 > s.acknowledgedSequence,
    ) ||
    (await db.proofs
      .filter(
        (p) => p.synced === 0 && sessions.some((s) => s.id === p.sessionId),
      )
      .count())
  )
    throw new Error(
      "Upload saved work and close the active shift before leaving this account.",
    );
  for (const row of await db.drafts.toArray()) {
    if (await db.meta.get("legacy-shift-import:" + row.id)) continue;
    const scoped =
      !identity ||
      row.id.includes(identity.businessId + ":" + identity.userId) ||
      sessions.some((s) => row.id.includes(s.id));
    if (!scoped) continue;
    if (row.id.startsWith("attachment:"))
      throw new Error(
        "Upload pending attachments before leaving this account.",
      );
    const value = row.value as {
      cart?: Record<string, number>;
      receipt?: { pendingProofs?: unknown[]; pendingDiscountProof?: boolean };
      frozen?: unknown;
      counts?: Record<string, string>;
      amount?: string;
      cash?: string;
    };
    if (
      value.receipt
        ? value.receipt.pendingProofs?.length ||
          value.receipt.pendingDiscountProof
        : Object.keys(value.cart ?? {}).length ||
          value.frozen ||
          Object.values(value.counts ?? {}).some((v) => v.trim()) ||
          value.amount?.trim() ||
          value.cash?.trim()
    )
      throw new Error(
        "Finish or clear your saved checkout and count drafts before leaving this account.",
      );
  }
}
export async function clearSavedCheckouts() {
  // Account exit does not erase work. A later sign-in restores only its own identity.
  await shiftStore().meta.delete("identity");
  offlineChanged();
}
