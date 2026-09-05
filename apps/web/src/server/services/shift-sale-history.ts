import { requireDatabase } from "@miniros/db";
import { sales, saleItems, payments } from "@miniros/db/schema";
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { requireActiveBusiness } from "./access";
export async function getShiftSaleHistory(shiftId: string, cursor?: string) {
  const { business } = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: shiftId,
  });
  const db = requireDatabase();
  const [previous] = cursor
    ? await db
        .select({ id: sales.id, soldAt: sales.soldAt })
        .from(sales)
        .where(
          and(
            eq(sales.id, cursor),
            eq(sales.businessId, business.id),
            eq(sales.shiftId, shiftId),
          ),
        )
        .limit(1)
    : [];
  const rows = await db
    .select()
    .from(sales)
    .where(
      and(
        eq(sales.businessId, business.id),
        eq(sales.shiftId, shiftId),
        previous
          ? or(
              lt(sales.soldAt, previous.soldAt),
              and(eq(sales.soldAt, previous.soldAt), lt(sales.id, previous.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(sales.soldAt), desc(sales.id))
    .limit(51);
  const shown = rows.slice(0, 50),
    ids = shown.map((sale) => sale.id);
  const [items, tender] = ids.length
    ? await Promise.all([
        db
          .select()
          .from(saleItems)
          .where(
            and(
              eq(saleItems.businessId, business.id),
              inArray(saleItems.saleId, ids),
            ),
          ),
        db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.businessId, business.id),
              inArray(payments.saleId, ids),
            ),
          ),
      ])
    : [[], []];
  return {
    sales: shown.map((sale) => ({
      ...sale,
      items: items.filter((item) => item.saleId === sale.id),
      payments: tender.filter((payment) => payment.saleId === sale.id),
    })),
    nextCursor: rows.length > 50 ? shown.at(-1)!.id : null,
  };
}
