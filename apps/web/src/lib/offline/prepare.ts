import type { PreparedShift } from "@miniros/contracts";
import { requireOfflineShell } from "./readiness";
import { localInstallationId, savePreparedShift, shiftStore } from "./store";

// One request per shift in a tab, including React Strict Mode mounts.
const preparing = new Map<string, Promise<PreparedShift>>();
export function prepareShiftOnDevice(shiftId: string): Promise<PreparedShift> {
  const existing = preparing.get(shiftId);
  if (existing) return existing;
  const work = prepare(shiftId).finally(() => preparing.delete(shiftId));
  preparing.set(shiftId, work);
  return work;
}

async function prepare(shiftId: string) {
  await requireOfflineShell();
  const storageId = await localInstallationId();
  const response = await fetch("/api/offline/prepare", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      "x-miniros-storage": storageId,
    },
    body: JSON.stringify({ shiftId }),
  });
  const session = (await response.json()) as PreparedShift & { error?: string };
  if (!response.ok)
    throw new Error(
      session.error ?? "Couldn't load this shift. Reconnect and retry.",
    );
  if (session.snapshot.shiftId !== shiftId)
    throw new Error("The saved shift does not match. Reload and try again.");
  await savePreparedShift(session, {
    userId: session.snapshot.userId,
    businessId: session.snapshot.businessId,
    deviceId: session.deviceId,
  });
  const saved = await shiftStore().sessions.get(session.id);
  if (!saved)
    throw new Error(
      "The shift could not be saved. Check device storage and retry.",
    );
  await requireOfflineShell();
  // Persistence permission is best effort; denying it is not a failed save.
  await navigator.storage?.persist?.().catch(() => false);
  return session;
}
