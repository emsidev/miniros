import {
  bigint,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { employees } from "./employees";
import { inventoryItems, inventoryLocations } from "./inventory";
import { sales } from "./sales";
import { shifts } from "./shifts";
import {
  inventoryAdjustmentStatusEnum,
  requestStatusEnum,
  saleChangeRequestTypeEnum,
} from "./enums";

export const saleChangeRequests = pgTable(
  "sale_change_requests",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    requestType: saleChangeRequestTypeEnum("request_type").notNull(),
    status: requestStatusEnum("status").default("pending").notNull(),
    reason: text("reason").notNull(),
    requestedBy: uuid("requested_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    reviewedBy: uuid("reviewed_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    saleIdx: index("sale_change_requests_sale_id_idx").on(table.saleId),
  }),
);

export const cashDeductions = pgTable(
  "cash_deductions",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    reason: text("reason"),
    status: requestStatusEnum("status").default("pending").notNull(),
    requestedBy: uuid("requested_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    reviewedBy: uuid("reviewed_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shiftIdx: index("cash_deductions_shift_id_idx").on(table.shiftId),
  }),
);

export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    inventoryLocationId: uuid("inventory_location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "restrict" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantityDelta: numeric("quantity_delta", {
      precision: 14,
      scale: 3,
    }).notNull(),
    reason: text("reason").notNull(),
    status: inventoryAdjustmentStatusEnum("status")
      .default("pending")
      .notNull(),
    requestedBy: uuid("requested_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    reviewedBy: uuid("reviewed_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shiftIdx: index("inventory_adjustments_shift_id_idx").on(table.shiftId),
  }),
);
