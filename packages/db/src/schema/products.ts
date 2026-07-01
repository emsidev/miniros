import {
  bigint,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { productStatusEnum } from "./enums";

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: bigint("sort_order", { mode: "number" }).default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessIdx: index("product_categories_business_id_idx").on(
      table.businessId,
    ),
    businessNameUnique: uniqueIndex(
      "product_categories_business_name_unique",
    ).on(table.businessId, table.name),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    sku: text("sku"),
    description: text("description"),
    priceCents: bigint("price_cents", { mode: "number" }).default(0).notNull(),
    costCents: bigint("cost_cents", { mode: "number" }).default(0).notNull(),
    status: productStatusEnum("status").default("active").notNull(),
    isSellable: boolean("is_sellable").default(true).notNull(),
    requiresRecipeDeduction: boolean("requires_recipe_deduction")
      .default(false)
      .notNull(),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessIdx: index("products_business_id_idx").on(table.businessId),
    categoryIdx: index("products_category_id_idx").on(table.categoryId),
    businessSkuUnique: uniqueIndex("products_business_sku_unique").on(
      table.businessId,
      table.sku,
    ),
  }),
);
