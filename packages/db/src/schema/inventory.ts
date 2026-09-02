import {
  bigint,
  boolean,
  check,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "./business";
import { employees } from "./employees";
import {
  inventoryCountTypeEnum,
  inventoryEventTypeEnum,
  inventoryItemTypeEnum,
  inventoryLocationTypeEnum,
  productStatusEnum,
} from "./enums";
import { sellingLocations } from "./locations";
import { products } from "./products";
import { shifts } from "./shifts";

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    itemType: inventoryItemTypeEnum("item_type").notNull(),
    unit: text("unit").notNull(),
    defaultUnitCostCents: bigint("default_unit_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    trackStock: boolean("track_stock").default(true).notNull(),
    status: productStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessIdx: index("inventory_items_business_id_idx").on(table.businessId),
    businessSkuUnique: uniqueIndex("inventory_items_business_sku_unique").on(
      table.businessId,
      table.sku,
    ),
    nonnegativeUnitCost: check(
      "inventory_items_unit_cost_nonnegative",
      sql`${table.defaultUnitCostCents} >= 0`,
    ),
    allowedUnit: check(
      "inventory_items_unit_allowed",
      sql`${table.unit} in ('pcs', 'pack', 'box', 'bottle', 'cup', 'g', 'kg', 'ml', 'l')`,
    ),
    nonblankSku: check(
      "inventory_items_sku_nonblank",
      sql`length(trim(${table.sku})) > 0`,
    ),
  }),
);

export const productRecipeItems = pgTable(
  "product_recipe_items",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unit: text("unit").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    productIdx: index("product_recipe_items_product_id_idx").on(
      table.productId,
    ),
    productItemUnique: uniqueIndex(
      "product_recipe_items_product_item_unique",
    ).on(table.productId, table.inventoryItemId),
    positiveQuantity: check(
      "product_recipe_items_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
  }),
);

export const inventoryLocations = pgTable(
  "inventory_locations",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    sellingLocationId: uuid("selling_location_id").references(
      () => sellingLocations.id,
      { onDelete: "cascade" },
    ),
    shiftId: uuid("shift_id").references(() => shifts.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    locationType: inventoryLocationTypeEnum("location_type").notNull(),
    status: productStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    businessIdx: index("inventory_locations_business_id_idx").on(
      table.businessId,
    ),
    shiftIdx: index("inventory_locations_shift_id_idx").on(table.shiftId),
    shiftUnique: uniqueIndex("inventory_locations_shift_id_unique").on(
      table.shiftId,
    ),
  }),
);

export const inventoryEvents = pgTable(
  "inventory_events",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id").references(() => shifts.id, {
      onDelete: "set null",
    }),
    inventoryLocationId: uuid("inventory_location_id").references(
      () => inventoryLocations.id,
      { onDelete: "restrict" },
    ),
    eventType: inventoryEventTypeEnum("event_type").notNull(),
    sourceType: text("source_type"),
    sourceId: uuid("source_id"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    clientGeneratedId: uuid("client_generated_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shiftIdx: index("inventory_events_shift_id_idx").on(table.shiftId),
    businessClientIdUnique: uniqueIndex(
      "inventory_events_business_client_generated_id_unique",
    ).on(table.businessId, table.clientGeneratedId),
  }),
);

export const inventoryEventLines = pgTable(
  "inventory_event_lines",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => inventoryEvents.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantityDelta: numeric("quantity_delta", {
      precision: 14,
      scale: 3,
    }).notNull(),
    unit: text("unit").notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    eventIdx: index("inventory_event_lines_event_id_idx").on(table.eventId),
  }),
);

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    inventoryLocationId: uuid("inventory_location_id")
      .notNull()
      .references(() => inventoryLocations.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantityOnHand: numeric("quantity_on_hand", { precision: 14, scale: 3 })
      .default("0")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    locationItemIdx: index("inventory_balances_location_item_idx").on(
      table.inventoryLocationId,
      table.inventoryItemId,
    ),
    locationItemUnique: uniqueIndex(
      "inventory_balances_business_location_item_unique",
    ).on(table.businessId, table.inventoryLocationId, table.inventoryItemId),
  }),
);

export const shiftInventoryCounts = pgTable(
  "shift_inventory_counts",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "restrict" }),
    countType: inventoryCountTypeEnum("count_type").notNull(),
    countedQuantity: numeric("counted_quantity", {
      precision: 14,
      scale: 3,
    }).notNull(),
    unit: text("unit").notNull(),
    countedBy: uuid("counted_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    countedAt: timestamp("counted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shiftItemTypeUnique: uniqueIndex(
      "shift_inventory_counts_shift_item_type_unique",
    ).on(table.shiftId, table.inventoryItemId, table.countType),
  }),
);
