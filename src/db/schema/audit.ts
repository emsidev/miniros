import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { businesses } from "./business";
import { employees } from "./employees";
import { shifts } from "./shifts";

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  actorEmployeeId: uuid("actor_employee_id").references(() => employees.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  businessCreatedAtIdx: index("audit_logs_business_id_created_at_idx").on(table.businessId, table.createdAt),
  entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId)
}));
