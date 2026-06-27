import { numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { discountTypeEnum, promoStatusEnum } from "./enums";

export const promoRules = pgTable("promo_rules", {
  id: uuid("id").primaryKey(),
  businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  discountType: discountTypeEnum("discount_type").notNull(),
  discountValue: numeric("discount_value", { precision: 14, scale: 2 }).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: promoStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
