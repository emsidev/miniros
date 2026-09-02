import { getOfflineDatabase } from "./database";
import type {
  NewOfflineAction,
  OfflineActionType,
  OfflineQueueItem,
} from "./types";

const MAX_ERROR_LENGTH = 500;

export async function enqueueOfflineAction<T extends OfflineActionType>(
  action: NewOfflineAction<T>,
): Promise<OfflineQueueItem<T>> {
  const now = new Date().toISOString();
  const item: OfflineQueueItem<T> = {
    id: action.id ?? crypto.randomUUID(),
    businessId: action.businessId,
    type: action.type,
    payload: action.payload,
    status: "pending",
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await getOfflineDatabase().actions.add(item);
  return item;
}

export async function listPendingOfflineActions(
  businessId: string,
): Promise<OfflineQueueItem[]> {
  return getOfflineDatabase()
    .actions.where("[businessId+status]")
    .equals([businessId, "pending"])
    .sortBy("createdAt");
}

export async function markOfflineActionProcessing(id: string): Promise<void> {
  const db = getOfflineDatabase();
  await db.transaction("rw", db.actions, async () => {
    const item = await db.actions.get(id);
    if (!item || item.status === "synced") return;

    await db.actions.update(id, {
      status: "processing",
      attemptCount: item.attemptCount + 1,
      updatedAt: new Date().toISOString(),
      lastError: undefined,
    });
  });
}

export async function markOfflineActionSynced(id: string): Promise<void> {
  await getOfflineDatabase().actions.update(id, {
    status: "synced",
    updatedAt: new Date().toISOString(),
    lastError: undefined,
  });
}

export async function markOfflineActionFailed(
  id: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : "Sync failed";
  await getOfflineDatabase().actions.update(id, {
    status: "failed",
    updatedAt: new Date().toISOString(),
    lastError: message.slice(0, MAX_ERROR_LENGTH),
  });
}

export async function retryOfflineAction(id: string): Promise<void> {
  await getOfflineDatabase().actions.update(id, {
    status: "pending",
    updatedAt: new Date().toISOString(),
    lastError: undefined,
  });
}
