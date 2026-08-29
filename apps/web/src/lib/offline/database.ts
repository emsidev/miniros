import Dexie, { type EntityTable } from "dexie";

import type { OfflineQueueItem } from "./types";

class MinirosOfflineDatabase extends Dexie {
  actions!: EntityTable<OfflineQueueItem, "id">;

  constructor() {
    super("miniros-offline");
    this.version(1).stores({
      actions: "&id, [businessId+status], type, createdAt, updatedAt",
    });
  }
}

let database: MinirosOfflineDatabase | undefined;

export function getOfflineDatabase(): MinirosOfflineDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("The offline queue is only available in a browser.");
  }

  database ??= new MinirosOfflineDatabase();
  return database;
}
