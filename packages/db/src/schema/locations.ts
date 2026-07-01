import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { locationTypeEnum, productStatusEnum } from "./enums";

export const sellingLocations = pgTable(
  "selling_locations",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    locationType: locationTypeEnum("location_type").default("booth").notNull(),
    address: text("address"),
    notes: text("notes"),
    defaultRentalCostCents: bigint("default_rental_cost_cents", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    defaultTransportCostCents: bigint("default_transport_cost_cents", {
      mode: "number",
    })
      .default(0)
      .notNull(),
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
    businessIdx: index("selling_locations_business_id_idx").on(
      table.businessId,
    ),
  }),
);
