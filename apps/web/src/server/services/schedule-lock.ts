import { sql } from "drizzle-orm";
import type { ShiftTransaction } from "./admin-shift-persistence";

/** Take before any shift/employee row locks in scheduling workflows.
 * Serializes joins with admin creation, team replacement, and date changes,
 * including conflicts on other shifts that do not exist yet.
 */
export async function lockBusinessSchedule(
  tx: ShiftTransaction,
  businessId: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`schedule:${businessId}`}, 0))`,
  );
}
