import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { employees } from "./employees";
import { closeoutStatusEnum, profitResultEnum } from "./enums";
import { sellingLocations } from "./locations";
import { shifts } from "./shifts";

export const shiftCloseouts = pgTable(
  "shift_closeouts",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    status: closeoutStatusEnum("status").default("submitted").notNull(),
    submittedBy: uuid("submitted_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    approvedBy: uuid("approved_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    notes: text("notes"),
    clientGeneratedId: uuid("client_generated_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shiftUnique: uniqueIndex("shift_closeouts_shift_id_unique").on(
      table.shiftId,
    ),
    businessClientIdUnique: uniqueIndex(
      "shift_closeouts_business_client_generated_id_unique",
    ).on(table.businessId, table.clientGeneratedId),
  }),
);

export const cashReconciliations = pgTable("cash_reconciliations", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  closeoutId: uuid("closeout_id")
    .notNull()
    .references(() => shiftCloseouts.id, { onDelete: "cascade" }),
  expectedCashCents: bigint("expected_cash_cents", { mode: "number" })
    .default(0)
    .notNull(),
  actualCashCents: bigint("actual_cash_cents", { mode: "number" })
    .default(0)
    .notNull(),
  cashDifferenceCents: bigint("cash_difference_cents", { mode: "number" })
    .default(0)
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const shiftProfitSummaries = pgTable(
  "shift_profit_summaries",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    sellingLocationId: uuid("selling_location_id")
      .notNull()
      .references(() => sellingLocations.id, { onDelete: "cascade" }),
    grossSalesCents: bigint("gross_sales_cents", { mode: "number" })
      .default(0)
      .notNull(),
    totalDiscountsCents: bigint("total_discounts_cents", { mode: "number" })
      .default(0)
      .notNull(),
    netSalesCents: bigint("net_sales_cents", { mode: "number" })
      .default(0)
      .notNull(),
    cashSalesCents: bigint("cash_sales_cents", { mode: "number" })
      .default(0)
      .notNull(),
    nonCashSalesCents: bigint("non_cash_sales_cents", { mode: "number" })
      .default(0)
      .notNull(),
    salaryCostCents: bigint("salary_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    rentalCostCents: bigint("rental_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    transportCostCents: bigint("transport_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    approvedDeductionsCents: bigint("approved_deductions_cents", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    otherCostsCents: bigint("other_costs_cents", { mode: "number" })
      .default(0)
      .notNull(),
    totalCostsCents: bigint("total_costs_cents", { mode: "number" })
      .default(0)
      .notNull(),
    profitCents: bigint("profit_cents", { mode: "number" })
      .default(0)
      .notNull(),
    result: profitResultEnum("result").notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shiftUnique: uniqueIndex("shift_profit_summaries_shift_id_unique").on(
      table.shiftId,
    ),
    locationIdx: index("shift_profit_summaries_location_id_idx").on(
      table.sellingLocationId,
    ),
  }),
);
