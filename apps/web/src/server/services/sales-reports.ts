import { requireDatabase } from "@miniros/db";
import { payments, saleItems, sales, shifts } from "@miniros/db/schema";
import { sumCents, sumQuantities } from "@miniros/domain";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireActiveBusiness } from "./access";

const reportFiltersSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type SalesReportFilters = z.infer<typeof reportFiltersSchema>;

export async function getSalesReport(rawFilters: SalesReportFilters = {}) {
  const filters = reportFiltersSchema.parse(rawFilters);
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const dateConditions = [
    filters.from ? gte(shifts.shiftDate, filters.from) : undefined,
    filters.to ? lte(shifts.shiftDate, filters.to) : undefined,
  ];
  const [salesRows, paymentRows, productRows] = await Promise.all([
    database
      .select({
        subtotalCents: sales.subtotalCents,
        discountCents: sales.discountCents,
        totalCents: sales.totalCents,
      })
      .from(sales)
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, sales.shiftId),
          eq(shifts.businessId, sales.businessId),
        ),
      )
      .where(
        and(
          eq(sales.businessId, business.id),
          eq(sales.status, "completed"),
          ...dateConditions,
        ),
      ),
    database
      .select({
        paymentMethod: payments.paymentMethod,
        amountCents: payments.amountCents,
      })
      .from(payments)
      .innerJoin(
        sales,
        and(
          eq(sales.id, payments.saleId),
          eq(sales.businessId, payments.businessId),
        ),
      )
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, sales.shiftId),
          eq(shifts.businessId, sales.businessId),
        ),
      )
      .where(
        and(
          eq(payments.businessId, business.id),
          eq(payments.status, "completed"),
          eq(sales.status, "completed"),
          ...dateConditions,
        ),
      ),
    database
      .select({
        productName: saleItems.productNameSnapshot,
        quantity: saleItems.quantity,
        lineTotalCents: saleItems.lineTotalCents,
      })
      .from(saleItems)
      .innerJoin(
        sales,
        and(
          eq(sales.id, saleItems.saleId),
          eq(sales.businessId, saleItems.businessId),
        ),
      )
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, sales.shiftId),
          eq(shifts.businessId, sales.businessId),
        ),
      )
      .where(
        and(
          eq(saleItems.businessId, business.id),
          eq(sales.status, "completed"),
          ...dateConditions,
        ),
      ),
  ]);

  const paymentsByMethod = new Map<
    string,
    {
      paymentMethod: (typeof paymentRows)[number]["paymentMethod"];
      amountCents: number;
      count: number;
    }
  >();
  paymentRows.forEach((row) => {
    const current = paymentsByMethod.get(row.paymentMethod) ?? {
      paymentMethod: row.paymentMethod,
      amountCents: 0,
      count: 0,
    };
    current.amountCents = sumCents(current.amountCents, row.amountCents);
    current.count += 1;
    paymentsByMethod.set(row.paymentMethod, current);
  });

  const productsByName = new Map<
    string,
    { productName: string; quantity: string[]; revenueCents: number }
  >();
  productRows.forEach((row) => {
    const current = productsByName.get(row.productName) ?? {
      productName: row.productName,
      quantity: [],
      revenueCents: 0,
    };
    current.quantity.push(row.quantity);
    current.revenueCents = sumCents(current.revenueCents, row.lineTotalCents);
    productsByName.set(row.productName, current);
  });

  return {
    saleCount: salesRows.length,
    grossSalesCents: sumCents(...salesRows.map((row) => row.subtotalCents)),
    totalDiscountsCents: sumCents(...salesRows.map((row) => row.discountCents)),
    netSalesCents: sumCents(...salesRows.map((row) => row.totalCents)),
    payments: [...paymentsByMethod.values()].sort((left, right) =>
      left.paymentMethod.localeCompare(right.paymentMethod),
    ),
    products: [...productsByName.values()]
      .map((product) => ({
        productName: product.productName,
        quantity: sumQuantities(product.quantity),
        revenueCents: product.revenueCents,
      }))
      .sort((left, right) => right.revenueCents - left.revenueCents),
  };
}
