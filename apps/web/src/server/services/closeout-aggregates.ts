import type { PreparedSnapshot } from "@miniros/contracts";
import {
  cashDeductions,
  payments,
  saleItems,
  sales,
  shiftAssignments,
  shiftCosts,
} from "@miniros/db/schema";
import {
  addCents,
  assertNonNegativeCents,
  calculateShiftProfit,
  multiplyCentsByQuantity,
  subtractCents,
} from "@miniros/domain";
import { and, eq, inArray, sql } from "drizzle-orm";

import { AccessError } from "./access";
import type { OperationalTransaction } from "./operational-helpers";

function aggregateCents(
  value: string | number | null | undefined,
  label: string,
) {
  const cents = Number(value ?? 0);
  assertNonNegativeCents(cents, label);
  return cents;
}

export async function aggregateCloseoutFinancials(
  tx: OperationalTransaction,
  businessId: string,
  shiftId: string,
  preparedCosts?: PreparedSnapshot["costs"],
) {
  const [saleTotalRows, productCostRows] = await Promise.all([
    tx
      .select({
        gross: sql<string>`coalesce(sum(${sales.totalCents}), 0)`,
        discounts: sql<string>`coalesce(sum(${sales.discountCents}), 0)`,
        change: sql<string>`coalesce(sum(${sales.changeCents}), 0)`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.shiftId, shiftId),
          eq(sales.status, "completed"),
        ),
      ),
    tx
      .select({
        unitCostCents: saleItems.unitCostCents,
        quantity: saleItems.quantity,
      })
      .from(saleItems)
      .innerJoin(
        sales,
        and(
          eq(sales.id, saleItems.saleId),
          eq(sales.businessId, saleItems.businessId),
        ),
      )
      .where(
        and(
          eq(saleItems.businessId, businessId),
          eq(sales.shiftId, shiftId),
          eq(sales.status, "completed"),
        ),
      ),
  ]);
  const saleTotals = saleTotalRows[0];
  const [paymentTotals] = await tx
    .select({
      cash: sql<string>`coalesce(sum(case when ${payments.paymentMethod} = 'cash' then ${payments.amountCents} else 0 end), 0)`,
      nonCash: sql<string>`coalesce(sum(case when ${payments.paymentMethod} <> 'cash' then ${payments.amountCents} else 0 end), 0)`,
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
        eq(payments.businessId, businessId),
        eq(payments.status, "completed"),
        eq(sales.shiftId, shiftId),
        eq(sales.status, "completed"),
      ),
    );
  const [salaryTotals] = await tx
    .select({
      salary: sql<string>`coalesce(sum(${shiftAssignments.salaryRateCents}), 0)`,
    })
    .from(shiftAssignments)
    .where(
      and(
        eq(shiftAssignments.businessId, businessId),
        eq(shiftAssignments.shiftId, shiftId),
        inArray(shiftAssignments.status, [
          "assigned",
          "confirmed",
          "completed",
        ]),
      ),
    );
  const [costTotals] = await tx
    .select({
      rent: sql<string>`coalesce(sum(case when ${shiftCosts.costType} = 'rent' then ${shiftCosts.amountCents} else 0 end), 0)`,
      transport: sql<string>`coalesce(sum(case when ${shiftCosts.costType} = 'transport' then ${shiftCosts.amountCents} else 0 end), 0)`,
      other: sql<string>`coalesce(sum(case when ${shiftCosts.costType} = 'other' then ${shiftCosts.amountCents} else 0 end), 0)`,
    })
    .from(shiftCosts)
    .where(
      and(
        eq(shiftCosts.businessId, businessId),
        eq(shiftCosts.shiftId, shiftId),
      ),
    );
  const [deductionTotals] = await tx
    .select({
      approved: sql<string>`coalesce(sum(${cashDeductions.amountCents}), 0)`,
    })
    .from(cashDeductions)
    .where(
      and(
        eq(cashDeductions.businessId, businessId),
        eq(cashDeductions.shiftId, shiftId),
        eq(cashDeductions.status, "approved"),
      ),
    );

  const grossSalesCents = aggregateCents(saleTotals?.gross, "grossSalesCents");
  const changeCents = aggregateCents(saleTotals?.change, "changeCents");
  const cashSalesCents = subtractCents(
    aggregateCents(paymentTotals?.cash, "cashPaymentsCents"),
    changeCents,
  );
  if (cashSalesCents < 0) {
    throw new AccessError("Cash payments and change are inconsistent.");
  }
  const nonCashSalesCents = aggregateCents(
    paymentTotals?.nonCash,
    "nonCashSalesCents",
  );
  if (addCents(cashSalesCents, nonCashSalesCents) !== grossSalesCents) {
    throw new AccessError("Completed sales and payments do not reconcile.");
  }
  const approvedDeductionsCents = aggregateCents(
    deductionTotals?.approved,
    "approvedDeductionsCents",
  );
  const productCostCents = addCents(
    ...productCostRows.map((item) =>
      multiplyCentsByQuantity(item.unitCostCents, item.quantity),
    ),
  );
  const summary = calculateShiftProfit({
    grossSalesCents,
    totalDiscountsCents: aggregateCents(
      saleTotals?.discounts,
      "totalDiscountsCents",
    ),
    netSalesCents: grossSalesCents,
    cashSalesCents,
    nonCashSalesCents,
    salaryCostCents:
      preparedCosts?.salaryCents ??
      aggregateCents(salaryTotals?.salary, "salaryCostCents"),
    rentalCostCents:
      preparedCosts?.rentCents ??
      aggregateCents(costTotals?.rent, "rentalCostCents"),
    transportCostCents:
      preparedCosts?.transportCents ??
      aggregateCents(costTotals?.transport, "transportCostCents"),
    otherCostsCents:
      preparedCosts?.otherCents ??
      aggregateCents(costTotals?.other, "otherCostsCents"),
    productCostCents,
    approvedDeductionsCents,
  });

  return {
    summary,
    expectedCashCents: subtractCents(cashSalesCents, approvedDeductionsCents),
  };
}
