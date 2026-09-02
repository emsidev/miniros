import { requireDatabase } from "@miniros/db";
import {
  inventoryLocations,
  productionLogs,
  products,
  sellingLocations,
  shifts,
} from "@miniros/db/schema";
import { sumQuantities } from "@miniros/domain";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
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

function startOfDay(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayAfter(value: string) {
  const date = startOfDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export async function listProductionOverview(
  rawFilters: ProductionFilters = {},
) {
  const filters = productionFiltersSchema.parse(rawFilters);
  const { business } = await requireActiveBusiness({
    admin: true,
    feature: "production",
  });
  const rows = await requireDatabase()
    .select({
      id: productionLogs.id,
      productName: products.name,
      quantityProduced: productionLogs.quantityProduced,
      unit: productionLogs.unit,
      shiftId: productionLogs.shiftId,
      shiftDate: shifts.shiftDate,
      inventoryLocationName: inventoryLocations.name,
      legacyBoothName: sellingLocations.name,
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
    .leftJoin(
      shifts,
      and(
        eq(shifts.id, productionLogs.shiftId),
        eq(shifts.businessId, productionLogs.businessId),
      ),
    )
    .leftJoin(
      sellingLocations,
      and(
        eq(sellingLocations.id, shifts.sellingLocationId),
        eq(sellingLocations.businessId, shifts.businessId),
      ),
    )
    .leftJoin(
      inventoryLocations,
      and(
        eq(inventoryLocations.id, productionLogs.inventoryLocationId),
        eq(inventoryLocations.businessId, productionLogs.businessId),
        isNull(inventoryLocations.deletedAt),
      ),
    )
    .where(
      and(
        eq(productionLogs.businessId, business.id),
        filters.from
          ? gte(productionLogs.createdAt, startOfDay(filters.from))
          : undefined,
        filters.to
          ? lt(productionLogs.createdAt, dayAfter(filters.to))
          : undefined,
      ),
    )
    .orderBy(desc(productionLogs.createdAt))
    .limit(100);

  const normalizedRows = rows.map((row) => ({
    ...row,
    locationName: row.shiftId
      ? (row.legacyBoothName ?? row.inventoryLocationName ?? "Former booth")
      : (row.inventoryLocationName ?? "Central inventory"),
  }));
  const totals = new Map<
    string,
    { productName: string; unit: string; quantities: string[] }
  >();
  normalizedRows.forEach((row) => {
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
    rows: normalizedRows,
    totals: [...totals.values()]
      .map((total) => ({
        productName: total.productName,
        unit: total.unit,
        quantityProduced: sumQuantities(total.quantities),
      }))
      .sort((left, right) => left.productName.localeCompare(right.productName)),
  };
}
