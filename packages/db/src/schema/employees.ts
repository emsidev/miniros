import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses, businessMembers } from "./business";
import { employeeStatusEnum } from "./enums";

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => businessMembers.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    status: employeeStatusEnum("status").default("active").notNull(),
    defaultShiftRateCents: bigint("default_shift_rate_cents", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    canUsePos: boolean("can_use_pos").default(false).notNull(),
    canLogProduction: boolean("can_log_production").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessIdx: index("employees_business_id_idx").on(table.businessId),
    memberIdx: index("employees_member_id_idx").on(table.memberId),
    businessEmailUnique: uniqueIndex("employees_business_email_unique").on(
      table.businessId,
      table.email,
    ),
    nonnegativeShiftRate: check(
      "employees_default_shift_rate_nonnegative",
      sql`${table.defaultShiftRateCents} >= 0`,
    ),
  }),
);
