import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { businesses } from "./business";
import { offlineActionStatusEnum, offlineActionTypeEnum } from "./enums";
import { shifts } from "./shifts";

export const offlineSyncActions = pgTable("offline_sync_actions", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  clientActionId: uuid("client_action_id").notNull(),
  actionType: offlineActionTypeEnum("action_type").notNull(),
  status: offlineActionStatusEnum("status").default("pending").notNull(),
  payload: jsonb("payload").notNull(),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0).notNull(),
  createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true })
}, (table) => ({
  businessClientActionUnique: uniqueIndex("offline_sync_actions_business_client_action_unique").on(table.businessId, table.clientActionId),
  shiftIdx: index("offline_sync_actions_shift_id_idx").on(table.shiftId)
}));
