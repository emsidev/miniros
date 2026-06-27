import { bigint, date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { employees } from "./employees";
import { shiftAssignmentRoleEnum, shiftAssignmentStatusEnum, shiftCostTypeEnum, shiftStatusEnum } from "./enums";
import { sellingLocations } from "./locations";

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  sellingLocationId: uuid("selling_location_id").notNull().references(() => sellingLocations.id, { onDelete: "restrict" }),
  title: text("title"),
  shiftDate: date("shift_date").notNull(),
  scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
  scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
  actualStartAt: timestamp("actual_start_at", { withTimezone: true }),
  actualEndAt: timestamp("actual_end_at", { withTimezone: true }),
  status: shiftStatusEnum("status").default("scheduled").notNull(),
  startedBy: uuid("started_by").references(() => employees.id, { onDelete: "set null" }),
  closedBy: uuid("closed_by").references(() => employees.id, { onDelete: "set null" }),
  notes: text("notes"),
  clientGeneratedId: uuid("client_generated_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  businessIdx: index("shifts_business_id_idx").on(table.businessId),
  locationIdx: index("shifts_selling_location_id_idx").on(table.sellingLocationId),
  businessClientIdUnique: uniqueIndex("shifts_business_client_generated_id_unique").on(table.businessId, table.clientGeneratedId)
}));

export const shiftAssignments = pgTable("shift_assignments", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  roleOnShift: shiftAssignmentRoleEnum("role_on_shift").default("employee").notNull(),
  salaryRateCents: bigint("salary_rate_cents", { mode: "number" }).default(0).notNull(),
  status: shiftAssignmentStatusEnum("status").default("assigned").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shiftIdx: index("shift_assignments_shift_id_idx").on(table.shiftId),
  businessShiftEmployeeUnique: uniqueIndex("shift_assignments_shift_employee_unique").on(table.shiftId, table.employeeId)
}));

export const shiftCosts = pgTable("shift_costs", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  costType: shiftCostTypeEnum("cost_type").notNull(),
  label: text("label").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).default(0).notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => employees.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  shiftIdx: index("shift_costs_shift_id_idx").on(table.shiftId)
}));
