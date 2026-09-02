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
    ).on(table.businessId, sql`lower(${table.name})`),
  }),
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    description: text("description"),
    priceCents: bigint("price_cents", { mode: "number" }).default(0).notNull(),
    costCents: bigint("cost_cents", { mode: "number" }).default(0).notNull(),
    manualCostCents: bigint("manual_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    laborCostCents: bigint("labor_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    overheadCostCents: bigint("overhead_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    costOverrideCents: bigint("cost_override_cents", { mode: "number" }),
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
    nonnegativePrice: check(
      "products_price_nonnegative",
      sql`${table.priceCents} >= 0`,
    ),
    nonnegativeCost: check(
      "products_cost_nonnegative",
      sql`${table.costCents} >= 0`,
    ),
    nonnegativeManualCost: check(
      "products_manual_cost_nonnegative",
      sql`${table.manualCostCents} >= 0`,
    ),
    nonnegativeLaborCost: check(
      "products_labor_cost_nonnegative",
      sql`${table.laborCostCents} >= 0`,
    ),
    nonnegativeOverheadCost: check(
      "products_overhead_cost_nonnegative",
      sql`${table.overheadCostCents} >= 0`,
    ),
    nonnegativeCostOverride: check(
      "products_cost_override_nonnegative",
      sql`${table.costOverrideCents} is null or ${table.costOverrideCents} >= 0`,
    ),
    nonblankSku: check(
      "products_sku_nonblank",
      sql`length(trim(${table.sku})) > 0`,
    ),
  }),
);
