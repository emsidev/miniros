import { requireDatabase } from "@miniros/db";
import { cashDeductions, payments, sales } from "@miniros/db/schema";
import { and, eq, sql } from "drizzle-orm";

import { resolveOperationalShift } from "./operator-workspace-core";
import { getInventoryWorkspace } from "./operator-workspaces";

export async function getCloseoutWorkspace(shiftId: string) {
  const workspace = await getInventoryWorkspace(shiftId);
  const { access, shift } = await resolveOperationalShift({
    permission: "pos",
    shiftId,
    statuses: ["active", "closing"],
  });
  const database = requireDatabase();
  const [saleSummary, paymentSummary, deductionSummary] = await Promise.all([
    database
      .select({
        grossSalesCents: sql<string>`coalesce(sum(${sales.totalCents}), 0)`,
        discountsCents: sql<string>`coalesce(sum(${sales.discountCents}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, access.business.id),
          eq(sales.shiftId, shift.id),
          eq(sales.status, "completed"),
        ),
      ),
    database
      .select({
        method: payments.paymentMethod,
        amountCents: sql<string>`coalesce(sum(${payments.amountCents}), 0)`,
      })
      .from(payments)
      .innerJoin(
        sales,
        and(
          eq(sales.id, payments.saleId),
          eq(sales.businessId, payments.businessId),
        ),
      )
      .where(
        and(
          eq(payments.businessId, access.business.id),
          eq(payments.status, "completed"),
          eq(sales.shiftId, shift.id),
          eq(sales.status, "completed"),
        ),
      )
      .groupBy(payments.paymentMethod),
    database
      .select({
        amountCents: sql<string>`coalesce(sum(${cashDeductions.amountCents}), 0)`,
      })
      .from(cashDeductions)
      .where(
        and(
          eq(cashDeductions.businessId, access.business.id),
          eq(cashDeductions.shiftId, shift.id),
          eq(cashDeductions.status, "approved"),
        ),
      ),
  ]);

  return {
    ...workspace,
    shift,
    saleSummary: {
      grossSalesCents: Number(saleSummary[0]?.grossSalesCents ?? 0),
      discountsCents: Number(saleSummary[0]?.discountsCents ?? 0),
    },
    paymentSummary: paymentSummary.map((row) => ({
      ...row,
      amountCents: Number(row.amountCents),
    })),
    approvedDeductionsCents: Number(deductionSummary[0]?.amountCents ?? 0),
  };
}
