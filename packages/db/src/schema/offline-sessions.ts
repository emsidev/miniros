import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "./business";
import { authUsers } from "./auth";
import { shifts } from "./shifts";
import { sellingLocations } from "./locations";

// No browser writes: all changes go through authenticated transactional services.
export const offlinePilots = pgTable("offline_pilots", {
  businessId: uuid("business_id")
    .primaryKey()
    .references(() => businesses.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => sellingLocations.id),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const offlineShiftSessions = pgTable(
  "offline_shift_sessions",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    deviceId: text("device_id").notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    status: text("status").notNull().default("prepared"),
    acknowledgedSequence: integer("acknowledged_sequence").notNull().default(0),
    lastOccurredAt: timestamp("last_occurred_at", { withTimezone: true }),
    closeoutIntent: jsonb("closeout_intent"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    shiftOwner: uniqueIndex("offline_shift_one_owner")
      .on(t.businessId, t.shiftId)
      .where(sql`${t.status} not in ('closed', 'released')`),
    userDevice: index("offline_session_user_device").on(t.userId, t.deviceId),
  }),
);
