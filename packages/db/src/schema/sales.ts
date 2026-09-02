import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "./auth";
import { businesses } from "./business";
import { employees } from "./employees";
import {
  fileTypeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  saleStatusEnum,
} from "./enums";
import { sellingLocations } from "./locations";
import { products } from "./products";
import { shifts } from "./shifts";

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    bucketId: text("bucket_id").notNull(),
    objectPath: text("object_path").notNull(),
    fileType: fileTypeEnum("file_type").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    uploadedBy: uuid("uploaded_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    objectUnique: uniqueIndex("files_bucket_object_unique").on(
      table.bucketId,
      table.objectPath,
    ),
  }),
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "restrict" }),
    sellingLocationId: uuid("selling_location_id")
      .notNull()
      .references(() => sellingLocations.id, { onDelete: "restrict" }),
    saleNumber: text("sale_number").notNull(),
    status: saleStatusEnum("status").default("completed").notNull(),
    subtotalCents: bigint("subtotal_cents", { mode: "number" })
      .default(0)
      .notNull(),
    discountCents: bigint("discount_cents", { mode: "number" })
      .default(0)
      .notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).default(0).notNull(),
    amountPaidCents: bigint("amount_paid_cents", { mode: "number" })
      .default(0)
      .notNull(),
    changeCents: bigint("change_cents", { mode: "number" })
      .default(0)
      .notNull(),
    soldBy: uuid("sold_by").references(() => employees.id, {
      onDelete: "set null",
    }),
    soldAt: timestamp("sold_at", { withTimezone: true }).defaultNow().notNull(),
    clientGeneratedId: uuid("client_generated_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    shiftIdx: index("sales_shift_id_idx").on(table.shiftId),
    businessSaleNumberUnique: uniqueIndex(
      "sales_business_sale_number_unique",
    ).on(table.businessId, table.saleNumber),
    businessClientIdUnique: uniqueIndex(
      "sales_business_client_generated_id_unique",
    ).on(table.businessId, table.clientGeneratedId),
    nonnegativeTotals: check(
      "sales_totals_nonnegative",
      sql`${table.subtotalCents} >= 0 and ${table.discountCents} >= 0 and ${table.totalCents} >= 0 and ${table.amountPaidCents} >= 0 and ${table.changeCents} >= 0`,
    ),
  }),
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" })
      .default(0)
      .notNull(),
    discountCents: bigint("discount_cents", { mode: "number" })
      .default(0)
      .notNull(),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    saleIdx: index("sale_items_sale_id_idx").on(table.saleId),
    positiveQuantity: check(
      "sale_items_quantity_positive",
      sql`${table.quantity} > 0`,
    ),
    nonnegativeMoney: check(
      "sale_items_money_nonnegative",
      sql`${table.unitPriceCents} >= 0 and ${table.unitCostCents} >= 0 and ${table.discountCents} >= 0 and ${table.lineTotalCents} >= 0`,
    ),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    referenceNumber: text("reference_number"),
    proofFileId: uuid("proof_file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    status: paymentStatusEnum("status").default("completed").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    clientGeneratedId: uuid("client_generated_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    saleIdx: index("payments_sale_id_idx").on(table.saleId),
    businessClientIdUnique: uniqueIndex(
      "payments_business_client_generated_id_unique",
    ).on(table.businessId, table.clientGeneratedId),
    positiveAmount: check(
      "payments_amount_positive",
      sql`${table.amountCents} > 0`,
    ),
  }),
);
