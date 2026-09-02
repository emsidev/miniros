import { requireDatabase } from "@miniros/db";
import {
  cashDeductions,
  employees,
  inventoryAdjustments,
  inventoryItems,
  sellingLocations,
  shifts,
} from "@miniros/db/schema";
import { and, desc, eq } from "drizzle-orm";

import { requireActiveBusiness } from "./access";

export async function listPendingApprovals() {
  const { business } = await requireActiveBusiness({
    admin: true,
    feature: "approvals",
  });
  const database = requireDatabase();
  const [cash, inventory] = await Promise.all([
    database
      .select({
        id: cashDeductions.id,
        shiftId: cashDeductions.shiftId,
        label: cashDeductions.label,
        reason: cashDeductions.reason,
        amountCents: cashDeductions.amountCents,
        createdAt: cashDeductions.createdAt,
        requestedByName: employees.displayName,
        locationName: sellingLocations.name,
      })
      .from(cashDeductions)
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, cashDeductions.shiftId),
          eq(shifts.businessId, cashDeductions.businessId),
        ),
      )
      .innerJoin(
        sellingLocations,
        and(
          eq(sellingLocations.id, shifts.sellingLocationId),
          eq(sellingLocations.businessId, shifts.businessId),
        ),
      )
      .leftJoin(
        employees,
        and(
          eq(employees.id, cashDeductions.requestedBy),
          eq(employees.businessId, cashDeductions.businessId),
        ),
      )
      .where(
        and(
          eq(cashDeductions.businessId, business.id),
          eq(cashDeductions.status, "pending"),
        ),
      )
      .orderBy(desc(cashDeductions.createdAt)),
    database
      .select({
        id: inventoryAdjustments.id,
        shiftId: inventoryAdjustments.shiftId,
        quantityDelta: inventoryAdjustments.quantityDelta,
        reason: inventoryAdjustments.reason,
        createdAt: inventoryAdjustments.createdAt,
        requestedByName: employees.displayName,
        itemName: inventoryItems.name,
        unit: inventoryItems.unit,
        locationName: sellingLocations.name,
      })
      .from(inventoryAdjustments)
      .innerJoin(
        shifts,
        and(
          eq(shifts.id, inventoryAdjustments.shiftId),
          eq(shifts.businessId, inventoryAdjustments.businessId),
        ),
      )
      .innerJoin(
        sellingLocations,
        and(
          eq(sellingLocations.id, shifts.sellingLocationId),
          eq(sellingLocations.businessId, shifts.businessId),
        ),
      )
      .innerJoin(
        inventoryItems,
        and(
          eq(inventoryItems.id, inventoryAdjustments.inventoryItemId),
          eq(inventoryItems.businessId, inventoryAdjustments.businessId),
        ),
      )
      .leftJoin(
        employees,
        and(
          eq(employees.id, inventoryAdjustments.requestedBy),
          eq(employees.businessId, inventoryAdjustments.businessId),
        ),
      )
      .where(
        and(
          eq(inventoryAdjustments.businessId, business.id),
          eq(inventoryAdjustments.status, "pending"),
        ),
      )
      .orderBy(desc(inventoryAdjustments.createdAt)),
  ]);

  return { cash, inventory };
}
