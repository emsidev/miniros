import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { employees } from "./employees";
import { stockTransferStatusEnum } from "./enums";
import { inventoryItems, inventoryLocations } from "./inventory";

export const stockReceivings = pgTable("stock_receivings", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  inventoryLocationId: uuid("inventory_location_id").notNull().references(() => inventoryLocations.id, { onDelete: "restrict" }),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  receivedBy: uuid("received_by").references(() => employees.id, { onDelete: "set null" }),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  clientGeneratedId: uuid("client_generated_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  businessClientIdUnique: uniqueIndex("stock_receivings_business_client_generated_id_unique").on(table.businessId, table.clientGeneratedId)
}));

export const stockReceivingLines = pgTable("stock_receiving_lines", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  stockReceivingId: uuid("stock_receiving_id").notNull().references(() => stockReceivings.id, { onDelete: "cascade" }),
  inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItems.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unit: text("unit").notNull(),
  unitCostCents: numeric("unit_cost_cents", { precision: 14, scale: 0 }).default("0").notNull()
}, (table) => ({
  receivingIdx: index("stock_receiving_lines_receiving_id_idx").on(table.stockReceivingId)
}));

export const stockTransfers = pgTable("stock_transfers", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  fromInventoryLocationId: uuid("from_inventory_location_id").notNull().references(() => inventoryLocations.id, { onDelete: "restrict" }),
  toInventoryLocationId: uuid("to_inventory_location_id").notNull().references(() => inventoryLocations.id, { onDelete: "restrict" }),
  status: stockTransferStatusEnum("status").default("completed").notNull(),
  notes: text("notes"),
  transferredBy: uuid("transferred_by").references(() => employees.id, { onDelete: "set null" }),
  transferredAt: timestamp("transferred_at", { withTimezone: true }).defaultNow().notNull(),
  clientGeneratedId: uuid("client_generated_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  businessClientIdUnique: uniqueIndex("stock_transfers_business_client_generated_id_unique").on(table.businessId, table.clientGeneratedId)
}));

export const stockTransferLines = pgTable("stock_transfer_lines", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  stockTransferId: uuid("stock_transfer_id").notNull().references(() => stockTransfers.id, { onDelete: "cascade" }),
  inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItems.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  unit: text("unit").notNull()
}, (table) => ({
  transferIdx: index("stock_transfer_lines_transfer_id_idx").on(table.stockTransferId)
}));
