import { randomUUID } from "node:crypto";
import type { LocationType } from "@miniros/contracts";
import { requireDatabase } from "@miniros/db";
import { auditLogs, sellingLocations, shifts } from "@miniros/db/schema";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";

export type LocationWriteInput = {
  name: string;
  locationType: LocationType;
  address: string | null;
  notes: string | null;
  defaultRentalCostCents: number;
  defaultTransportCostCents: number;
  status: "active" | "inactive";
};

function nullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function locationDto(row: typeof sellingLocations.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    locationType: row.locationType,
    address: row.address,
    notes: row.notes,
    defaultRentalCostCents: row.defaultRentalCostCents,
    defaultTransportCostCents: row.defaultTransportCostCents,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listLocations() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const rows = await database
    .select()
    .from(sellingLocations)
    .where(
      and(
        eq(sellingLocations.businessId, business.id),
        isNull(sellingLocations.deletedAt),
        ne(sellingLocations.status, "deleted"),
      ),
    )
    .orderBy(asc(sellingLocations.name));

  return rows.map(locationDto);
}

export async function createLocation(input: LocationWriteInput) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const locationId = randomUUID();
    const [created] = await tx
      .insert(sellingLocations)
      .values({
        id: locationId,
        businessId: access.business.id,
        name: input.name.trim(),
        locationType: input.locationType,
        address: nullableText(input.address),
        notes: nullableText(input.notes),
        defaultRentalCostCents: input.defaultRentalCostCents,
        defaultTransportCostCents: input.defaultTransportCostCents,
        status: input.status,
      })
      .returning();

    if (!created) {
      throw new Error("Location insert did not return a row.");
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "selling_location.created",
      entityType: "selling_location",
      entityId: locationId,
      metadata: {
        name: created.name,
        locationType: created.locationType,
        defaultRentalCostCents: created.defaultRentalCostCents,
        defaultTransportCostCents: created.defaultTransportCostCents,
      },
    });

    return locationDto(created);
  });
}

export async function updateLocation(
  locationId: string,
  input: LocationWriteInput,
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(sellingLocations)
      .where(
        and(
          eq(sellingLocations.id, locationId),
          eq(sellingLocations.businessId, access.business.id),
          isNull(sellingLocations.deletedAt),
          ne(sellingLocations.status, "deleted"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AccessError("Location not found.");
    }

    const [updated] = await tx
      .update(sellingLocations)
      .set({
        name: input.name.trim(),
        locationType: input.locationType,
        address: nullableText(input.address),
        notes: nullableText(input.notes),
        defaultRentalCostCents: input.defaultRentalCostCents,
        defaultTransportCostCents: input.defaultTransportCostCents,
        status: input.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sellingLocations.id, locationId),
          eq(sellingLocations.businessId, access.business.id),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Location update did not return a row.");
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "selling_location.updated",
      entityType: "selling_location",
      entityId: locationId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        defaultRentalCostCents: updated.defaultRentalCostCents,
        defaultTransportCostCents: updated.defaultTransportCostCents,
      },
    });

    return locationDto(updated);
  });
}

export async function softDeleteLocation(locationId: string) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: sellingLocations.id, name: sellingLocations.name })
      .from(sellingLocations)
      .where(
        and(
          eq(sellingLocations.id, locationId),
          eq(sellingLocations.businessId, access.business.id),
          isNull(sellingLocations.deletedAt),
          ne(sellingLocations.status, "deleted"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AccessError("Location not found.");
    }

    const [openShift] = await tx
      .select({ id: shifts.id })
      .from(shifts)
      .where(
        and(
          eq(shifts.businessId, access.business.id),
          eq(shifts.sellingLocationId, locationId),
          inArray(shifts.status, ["draft", "scheduled", "active", "closing"]),
          isNull(shifts.deletedAt),
        ),
      )
      .limit(1);

    if (openShift) {
      throw new AccessError(
        "Cancel or close this location's open shifts before deleting it.",
      );
    }

    const deletedAt = new Date();
    await tx
      .update(sellingLocations)
      .set({ status: "deleted", deletedAt, updatedAt: deletedAt })
      .where(
        and(
          eq(sellingLocations.id, locationId),
          eq(sellingLocations.businessId, access.business.id),
        ),
      );

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "selling_location.deleted",
      entityType: "selling_location",
      entityId: locationId,
      metadata: { name: existing.name },
    });

    return { id: locationId, deletedAt: deletedAt.toISOString() };
  });
}
