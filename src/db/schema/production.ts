import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { employees } from "./employees";
import { inventoryLocations } from "./inventory";
import { products } from "./products";
import { shifts } from "./shifts";

export const productionLogs = pgTable("production_logs", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
  inventoryLocationId: uuid("inventory_location_id").references(() => inventoryLocations.id, { onDelete: "restrict" }),
  quantityProduced: numeric("quantity_produced", { precision: 14, scale: 3 }).notNull(),
  unit: text("unit").default("pcs").notNull(),
  notes: text("notes"),
  loggedBy: uuid("logged_by").references(() => employees.id, { onDelete: "set null" }),
  clientGeneratedId: uuid("client_generated_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shiftIdx: index("production_logs_shift_id_idx").on(table.shiftId),
  businessClientIdUnique: uniqueIndex("production_logs_business_client_generated_id_unique").on(table.businessId, table.clientGeneratedId)
}));
