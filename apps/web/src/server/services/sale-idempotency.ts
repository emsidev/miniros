import { sales } from "@miniros/db/schema";
import { and, eq, or } from "drizzle-orm";

import type { OperationalTransaction } from "./operational-helpers";

export function findExistingSale(
  tx: OperationalTransaction,
  businessId: string,
  saleId: string,
) {
  return tx
    .select({
      id: sales.id,
      shiftId: sales.shiftId,
      totalCents: sales.totalCents,
      amountPaidCents: sales.amountPaidCents,
      changeCents: sales.changeCents,
    })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, businessId),
        or(eq(sales.id, saleId), eq(sales.clientGeneratedId, saleId)),
      ),
    )
    .limit(1)
    .then(([existing]) => existing);
}
