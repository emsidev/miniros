import { getOfflineDatabase } from "./database";
/** Read-only quarantine for the former, unconnected queue. Its records lack
 * authoritative snapshots and device ownership and cannot be safely replayed. */
export async function readLegacyOfflineRecords(businessId: string) {
  return getOfflineDatabase()
    .actions.filter((row) => row.businessId === businessId)
    .toArray();
}
