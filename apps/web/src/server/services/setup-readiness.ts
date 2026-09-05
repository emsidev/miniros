import { requireDatabase } from "@miniros/db";
import {
  products,
  sellingLocations,
  employees,
  shifts,
  shiftProfitSummaries,
  inventoryItems,
} from "@miniros/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireActiveBusiness } from "./access";

export async function getSetupReadiness() {
  const { business } = await requireActiveBusiness({ admin: true });
  const db = requireDatabase();
  const [catalog, locations, team, planned, results, inventory] =
    await Promise.all([
      db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.businessId, business.id),
            eq(products.status, "active"),
            eq(products.isSellable, true),
            isNull(products.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({ id: sellingLocations.id })
        .from(sellingLocations)
        .where(
          and(
            eq(sellingLocations.businessId, business.id),
            eq(sellingLocations.status, "active"),
            isNull(sellingLocations.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.businessId, business.id),
            eq(employees.status, "active"),
            eq(employees.canUsePos, true),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({ id: shifts.id })
        .from(shifts)
        .where(
          and(
            eq(shifts.businessId, business.id),
            inArray(shifts.status, [
              "scheduled",
              "active",
              "closing",
              "closed",
            ]),
            isNull(shifts.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({ id: shiftProfitSummaries.id })
        .from(shiftProfitSummaries)
        .where(eq(shiftProfitSummaries.businessId, business.id))
        .limit(1),
      db
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.businessId, business.id),
            eq(inventoryItems.status, "active"),
            isNull(inventoryItems.deletedAt),
          ),
        )
        .limit(1),
    ]);
  return {
    complete: results.length > 0,
    steps: [
      {
        label: "Add products, selling prices and costs",
        href: "/admin/products",
        done: catalog.length > 0,
      },
      {
        label: "Configure a selling location and its costs",
        href: "/admin/locations",
        done: locations.length > 0,
      },
      {
        label: "Give yourself or a teammate POS access",
        href: "/admin/employees",
        done: team.length > 0,
      },
      {
        label: "Add inventory for opening and closing counts",
        href: "/admin/inventory/items",
        done: inventory.length > 0,
      },
      {
        label: "Schedule and assign the first shift",
        href: "/admin/shifts/new",
        done: planned.length > 0 || results.length > 0,
      },
      {
        label: "Start, sell and reconcile a closeout",
        href: "/shifts",
        done: results.length > 0,
      },
    ],
  };
}
