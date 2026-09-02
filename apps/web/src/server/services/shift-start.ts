import { requireDatabase } from "@miniros/db";
import {
  inventoryEvents,
  inventoryLocations,
  sellingLocations,
  shifts,
} from "@miniros/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import { setInventoryCounts } from "./inventory-counts";
import {
  getShiftInventoryLocation,
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
} from "./operational-helpers";

export type StartShiftInput = {
  shiftId: string;
  inventoryLocationId: string;
  openingEventId: string;
  counts: readonly {
    inventoryItemId: string;
    quantity: number | string;
  }[];
  notes?: string | null;
};

export async function startAssignedShift(input: StartShiftInput) {
  const access = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: input.shiftId,
  });
  requireEmployee(access);
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existingEvent] = await tx
      .select({
        id: inventoryEvents.id,
        shiftId: inventoryEvents.shiftId,
        eventType: inventoryEvents.eventType,
      })
      .from(inventoryEvents)
      .where(
        and(
          eq(inventoryEvents.businessId, access.business.id),
          or(
            eq(inventoryEvents.id, input.openingEventId),
            eq(inventoryEvents.clientGeneratedId, input.openingEventId),
          ),
        ),
      )
      .limit(1);

    if (existingEvent) {
      if (
        existingEvent.shiftId !== input.shiftId ||
        existingEvent.eventType !== "opening_count"
      ) {
        throw new AccessError("The opening request ID is already in use.");
      }
      const location = await getShiftInventoryLocation(
        tx,
        access.business.id,
        input.shiftId,
      );
      return {
        shiftId: input.shiftId,
        inventoryLocationId: location.id,
        openingEventId: existingEvent.id,
        idempotent: true,
      };
    }

    const [shift] = await tx
      .select({
        id: shifts.id,
        sellingLocationId: shifts.sellingLocationId,
        title: shifts.title,
        status: shifts.status,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, input.shiftId),
          eq(shifts.businessId, access.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!shift) throw new AccessError("Shift not found.");
    if (shift.status !== "scheduled") {
      const [racedEvent] = await tx
        .select({
          id: inventoryEvents.id,
          shiftId: inventoryEvents.shiftId,
          eventType: inventoryEvents.eventType,
        })
        .from(inventoryEvents)
        .where(
          and(
            eq(inventoryEvents.businessId, access.business.id),
            or(
              eq(inventoryEvents.id, input.openingEventId),
              eq(inventoryEvents.clientGeneratedId, input.openingEventId),
            ),
          ),
        )
        .limit(1);
      if (
        racedEvent?.shiftId === input.shiftId &&
        racedEvent.eventType === "opening_count"
      ) {
        const racedLocation = await getShiftInventoryLocation(
          tx,
          access.business.id,
          input.shiftId,
        );
        return {
          shiftId: input.shiftId,
          inventoryLocationId: racedLocation.id,
          openingEventId: racedEvent.id,
          idempotent: true,
        };
      }
      throw new AccessError("Only a scheduled shift can be started.");
    }
    await requireCurrentAssignment(
      tx,
      access.business.id,
      shift.id,
      access.employee.id,
    );

    const [sellingLocation] = await tx
      .select({ id: sellingLocations.id, name: sellingLocations.name })
      .from(sellingLocations)
      .where(
        and(
          eq(sellingLocations.id, shift.sellingLocationId),
          eq(sellingLocations.businessId, access.business.id),
          eq(sellingLocations.status, "active"),
          isNull(sellingLocations.deletedAt),
        ),
      )
      .limit(1);

    if (!sellingLocation) {
      throw new AccessError("The shift selling location is unavailable.");
    }

    const [existingLocation] = await tx
      .select({
        id: inventoryLocations.id,
        sellingLocationId: inventoryLocations.sellingLocationId,
      })
      .from(inventoryLocations)
      .where(
        and(
          eq(inventoryLocations.businessId, access.business.id),
          eq(inventoryLocations.shiftId, shift.id),
          eq(inventoryLocations.locationType, "shift"),
          eq(inventoryLocations.status, "active"),
          isNull(inventoryLocations.deletedAt),
        ),
      )
      .limit(1);
    if (
      existingLocation &&
      existingLocation.sellingLocationId !== sellingLocation.id
    ) {
      throw new AccessError("The shift inventory location is inconsistent.");
    }
    const inventoryLocationId =
      existingLocation?.id ?? input.inventoryLocationId;
    if (!existingLocation) {
      await tx.insert(inventoryLocations).values({
        id: inventoryLocationId,
        businessId: access.business.id,
        sellingLocationId: sellingLocation.id,
        shiftId: shift.id,
        name: `${shift.title?.trim() || sellingLocation.name} inventory`,
        locationType: "shift",
        status: "active",
      });
    }

    await setInventoryCounts(tx, {
      businessId: access.business.id,
      shiftId: shift.id,
      inventoryLocationId,
      eventId: input.openingEventId,
      countType: "opening",
      employeeId: access.employee.id,
      notes: input.notes,
      counts: input.counts,
    });

    const startedAt = new Date();
    const [started] = await tx
      .update(shifts)
      .set({
        status: "active",
        actualStartAt: startedAt,
        startedBy: access.employee.id,
        updatedAt: startedAt,
      })
      .where(
        and(
          eq(shifts.id, shift.id),
          eq(shifts.businessId, access.business.id),
          eq(shifts.status, "scheduled"),
        ),
      )
      .returning({ id: shifts.id });

    if (!started) throw new AccessError("The shift could not be started.");

    await insertAuditLog(tx, access, {
      action: "shift.started",
      entityType: "shift",
      entityId: shift.id,
      shiftId: shift.id,
      metadata: {
        inventoryLocationId,
        openingEventId: input.openingEventId,
        countLines: input.counts.length,
      },
    });

    return {
      shiftId: shift.id,
      inventoryLocationId,
      openingEventId: input.openingEventId,
      actualStartAt: startedAt.toISOString(),
      idempotent: false,
    };
  });
}
