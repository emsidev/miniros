import { requireDatabase } from "@miniros/db";
import {
  productionLogs,
  products,
  sellingLocations,
  shifts,
} from "@miniros/db/schema";
import { sumQuantities } from "@miniros/domain";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireActiveBusiness } from "./access";

const productionFiltersSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type ProductionFilters = z.infer<typeof productionFiltersSchema>;

export async function listProductionOverview(
  rawFilters: ProductionFilters = {},
) {
  const filters = productionFiltersSchema.parse(rawFilters);
  const { business } = await requireActiveBusiness({ admin: true });
  const rows = await requireDatabase()
    .select({
      id: productionLogs.id,
      productName: products.name,
      quantityProduced: productionLogs.quantityProduced,
      unit: productionLogs.unit,
      shiftDate: shifts.shiftDate,
      locationName: sellingLocations.name,
      createdAt: productionLogs.createdAt,
    })
    .from(productionLogs)
    .innerJoin(
      products,
      and(
        eq(products.id, productionLogs.productId),
        eq(products.businessId, productionLogs.businessId),
      ),
    )
    .innerJoin(
      shifts,
      and(
        eq(shifts.id, productionLogs.shiftId),
        eq(shifts.businessId, productionLogs.businessId),
      ),
    )
    .innerJoin(
      sellingLocations,
      and(
        eq(sellingLocations.id, shifts.sellingLocationId),
        eq(sellingLocations.businessId, shifts.businessId),
      ),
    )
    .where(
      and(
        eq(productionLogs.businessId, business.id),
        filters.from ? gte(shifts.shiftDate, filters.from) : undefined,
        filters.to ? lte(shifts.shiftDate, filters.to) : undefined,
      ),
    )
    .orderBy(desc(productionLogs.createdAt))
    .limit(100);

  const totals = new Map<
    string,
    { productName: string; unit: string; quantities: string[] }
  >();
  rows.forEach((row) => {
    const key = `${row.productName}:${row.unit}`;
    const current = totals.get(key) ?? {
      productName: row.productName,
      unit: row.unit,
      quantities: [],
    };
    current.quantities.push(row.quantityProduced);
    totals.set(key, current);
  });

  return {
    rows,
    totals: [...totals.values()]
      .map((total) => ({
        productName: total.productName,
        unit: total.unit,
        quantityProduced: sumQuantities(total.quantities),
      }))
      .sort((left, right) => left.productName.localeCompare(right.productName)),
  };
}
