import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { businessStatusEnum, memberRoleEnum, memberStatusEnum } from "./enums";

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  status: businessStatusEnum("status").default("active").notNull(),
  createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  slugUnique: uniqueIndex("businesses_slug_unique").on(table.slug)
}));

export const businessMembers = pgTable("business_members", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  authUserId: uuid("auth_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  role: memberRoleEnum("role").notNull(),
  status: memberStatusEnum("status").default("pending").notNull(),
  invitedEmail: text("invited_email"),
  approvedBy: uuid("approved_by").references(() => authUsers.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
}, (table) => ({
  businessIdx: index("business_members_business_id_idx").on(table.businessId),
  authUserIdx: index("business_members_auth_user_id_idx").on(table.authUserId),
  businessUserUnique: uniqueIndex("business_members_business_auth_user_unique").on(table.businessId, table.authUserId)
}));
