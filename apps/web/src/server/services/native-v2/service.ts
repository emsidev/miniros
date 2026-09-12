import { requireDatabase, type Database } from "@miniros/db";
import { createNativeAdministration } from "./administration";
import { createNativeIngestion } from "./ingestion";
import { createNativeRecovery } from "./recovery";
import type { NativeOptions } from "./types";

export function createNativeV2Service(
  database: Database,
  options: NativeOptions = {},
) {
  const now = options.now ?? (() => new Date());
  return {
    ...createNativeAdministration(database, now),
    ...createNativeIngestion(database, now, options),
    importRecovery: createNativeRecovery(database, now, options),
  };
}
export function nativeV2Service() {
  return createNativeV2Service(requireDatabase());
}
