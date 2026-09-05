import { requireDatabase } from "@miniros/db";
import {
  cashDeductions,
  inventoryAdjustments,
  inventoryBalances,
  inventoryEventLines,
  inventoryEvents,
  inventoryItems,
  inventoryLocations,
  sellingLocations,
  shiftAssignments,
  shiftInventoryCounts,
  shifts,
} from "@miniros/db/schema";
import { isAdminMemberRole } from "@miniros/domain";
import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { selectInventoryShift } from "@/lib/inventory-workspace";
import { AccessError, requireActiveBusiness } from "./access";

/** Historical reads are separate from the eligibility checks for operational writes. */
export async function getInventoryWorkspace(
  shiftId?: string,
  movementPage = 1,
) {
  const access = await requireActiveBusiness();
  if (!access.employee)
    throw new AccessError("An active employee record is required.");
  const database = requireDatabase();
  const businessId = access.business.id;
  const assigned = await database
    .select({
      id: shifts.id,
      title: shifts.title,
      shiftDate: shifts.shiftDate,
      status: shifts.status,
      actualEndAt: shifts.actualEndAt,
      createdAt: shifts.createdAt,
      assignmentStatus: shiftAssignments.status,
      locationName: sellingLocations.name,
      locationStatus: sellingLocations.status,
      locationDeletedAt: sellingLocations.deletedAt,
      inventoryLocationId: inventoryLocations.id,
      inventoryLocationStatus: inventoryLocations.status,
      inventoryLocationDeletedAt: inventoryLocations.deletedAt,
    })
    .from(shiftAssignments)
    .innerJoin(
      shifts,
      and(
        eq(shifts.id, shiftAssignments.shiftId),
        eq(shifts.businessId, shiftAssignments.businessId),
      ),
    )
    .innerJoin(
      sellingLocations,
      and(
        eq(sellingLocations.id, shifts.sellingLocationId),
        eq(sellingLocations.businessId, businessId),
      ),
    )
    .leftJoin(
      inventoryLocations,
      and(
        eq(inventoryLocations.shiftId, shifts.id),
        eq(inventoryLocations.businessId, businessId),
        eq(inventoryLocations.locationType, "shift"),
      ),
    )
    .where(
      and(
        eq(shiftAssignments.businessId, businessId),
        eq(shiftAssignments.employeeId, access.employee.id),
        inArray(shiftAssignments.status, [
          "assigned",
          "confirmed",
          "completed",
        ]),
        inArray(shifts.status, ["active", "closing", "closed"]),
        isNull(shifts.deletedAt),
      ),
    );
  const { options, selected: shift } = selectInventoryShift(
    assigned.filter(
      (candidate) =>
        candidate.status === "closed" ||
        (candidate.locationStatus === "active" && !candidate.locationDeletedAt),
    ),
    shiftId,
  );
  const base = {
    businessId,
    approvalsEnabled: access.business.features.approvalsEnabled,
    adminVisibility: isAdminMemberRole(access.membership.role),
    shiftOptions: options.map(
      ({ id, title, shiftDate, status, assignmentStatus, locationName }) => ({
        id,
        title,
        shiftDate,
        status,
        assignmentStatus,
        locationName,
      }),
    ),
  };
  if (!shift)
    return {
      ...base,
      selected: null,
      unavailable:
        shiftId !== undefined
          ? ("requested_shift_unavailable" as const)
          : ("no_active_shift" as const),
    };
  const closed = shift.status === "closed";
  const canRecord =
    !closed &&
    Boolean(
      access.employee.canUsePos &&
      shift.inventoryLocationId &&
      shift.inventoryLocationStatus === "active" &&
      !shift.inventoryLocationDeletedAt,
    );
  const scopedLocation = shift.inventoryLocationId
    ? eq(inventoryEvents.inventoryLocationId, shift.inventoryLocationId)
    : eq(inventoryEvents.shiftId, shift.id);
  const [catalog, counts, balanceRows, eventRows, cashRows, adjustmentRows] =
    await Promise.all([
      database
        .select({
          id: inventoryItems.id,
          name: inventoryItems.name,
          unit: inventoryItems.unit,
          status: inventoryItems.status,
          deletedAt: inventoryItems.deletedAt,
          trackStock: inventoryItems.trackStock,
        })
        .from(inventoryItems)
        .where(eq(inventoryItems.businessId, businessId))
        .orderBy(asc(inventoryItems.name)),
      database
        .select({
          inventoryItemId: shiftInventoryCounts.inventoryItemId,
          countType: shiftInventoryCounts.countType,
          quantity: shiftInventoryCounts.countedQuantity,
          unit: shiftInventoryCounts.unit,
        })
        .from(shiftInventoryCounts)
        .where(
          and(
            eq(shiftInventoryCounts.businessId, businessId),
            eq(shiftInventoryCounts.shiftId, shift.id),
          ),
        ),
      shift.inventoryLocationId
        ? database
            .select({
              inventoryItemId: inventoryBalances.inventoryItemId,
              quantityOnHand: inventoryBalances.quantityOnHand,
            })
            .from(inventoryBalances)
            .where(
              and(
                eq(inventoryBalances.businessId, businessId),
                eq(
                  inventoryBalances.inventoryLocationId,
                  shift.inventoryLocationId,
                ),
              ),
            )
        : Promise.resolve([]),
      database
        .select({
          id: inventoryEventLines.id,
          eventType: inventoryEvents.eventType,
          createdAt: inventoryEvents.createdAt,
          inventoryItemId: inventoryEventLines.inventoryItemId,
          quantityDelta: inventoryEventLines.quantityDelta,
          unit: inventoryEventLines.unit,
          notes: inventoryEvents.notes,
        })
        .from(inventoryEvents)
        .innerJoin(
          inventoryEventLines,
          and(
            eq(inventoryEventLines.eventId, inventoryEvents.id),
            eq(inventoryEventLines.businessId, businessId),
          ),
        )
        .where(
          and(
            eq(inventoryEvents.businessId, businessId),
            scopedLocation,
            or(
              eq(inventoryEvents.shiftId, shift.id),
              isNull(inventoryEvents.shiftId),
            ),
            closed && shift.actualEndAt
              ? lte(inventoryEvents.createdAt, shift.actualEndAt)
              : undefined,
          ),
        )
        .orderBy(desc(inventoryEvents.createdAt), desc(inventoryEventLines.id))
        .limit(51)
        .offset((movementPage - 1) * 50),
      database
        .select({
          id: cashDeductions.id,
          label: cashDeductions.label,
          amountCents: cashDeductions.amountCents,
          reason: cashDeductions.reason,
          status: cashDeductions.status,
          createdAt: cashDeductions.createdAt,
        })
        .from(cashDeductions)
        .where(
          and(
            eq(cashDeductions.businessId, businessId),
            eq(cashDeductions.shiftId, shift.id),
            !base.adminVisibility
              ? eq(cashDeductions.requestedBy, access.employee.id)
              : undefined,
          ),
        )
        .orderBy(desc(cashDeductions.createdAt)),
      database
        .select({
          id: inventoryAdjustments.id,
          inventoryItemId: inventoryAdjustments.inventoryItemId,
          quantityDelta: inventoryAdjustments.quantityDelta,
          reason: inventoryAdjustments.reason,
          status: inventoryAdjustments.status,
          createdAt: inventoryAdjustments.createdAt,
        })
        .from(inventoryAdjustments)
        .where(
          and(
            eq(inventoryAdjustments.businessId, businessId),
            eq(inventoryAdjustments.shiftId, shift.id),
            !base.adminVisibility
              ? eq(inventoryAdjustments.requestedBy, access.employee.id)
              : undefined,
          ),
        )
        .orderBy(desc(inventoryAdjustments.createdAt)),
    ]);
  const itemById = new Map(catalog.map((item) => [item.id, item]));
  const balances = new Map(
    balanceRows.map((row) => [row.inventoryItemId, row.quantityOnHand]),
  );
  const opening = new Map(
    counts
      .filter((row) => row.countType === "opening")
      .map((row) => [row.inventoryItemId, row]),
  );
  const closing = new Map(
    counts
      .filter((row) => row.countType === "closing")
      .map((row) => [row.inventoryItemId, row]),
  );
  const itemIds = new Set(
    closed
      ? counts.map((row) => row.inventoryItemId)
      : [...balances.keys(), ...opening.keys()],
  );
  const stock = [...itemIds]
    .map((id) => ({
      inventoryItemId: id,
      name: itemById.get(id)?.name ?? "Archived inventory item",
      unit:
        (closed
          ? (closing.get(id)?.unit ?? opening.get(id)?.unit)
          : itemById.get(id)?.unit) ?? "",
      openingQuantity: opening.get(id)?.quantity ?? null,
      quantityOnHand: closed
        ? (closing.get(id)?.quantity ?? null)
        : (balances.get(id) ?? "0.000"),
      adjustable:
        canRecord &&
        itemById.get(id)?.status === "active" &&
        !itemById.get(id)?.deletedAt &&
        Boolean(itemById.get(id)?.trackStock),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    ...base,
    unavailable: null,
    selected: {
      shift: {
        id: shift.id,
        title: shift.title,
        shiftDate: shift.shiftDate,
        status: shift.status,
        assignmentStatus: shift.assignmentStatus,
        locationName: shift.locationName,
      },
      canRecord,
      closed,
      stock,
      items: catalog
        .filter(
          (item) =>
            item.status === "active" && !item.deletedAt && item.trackStock,
        )
        .map((item) => ({
          inventoryItemId: item.id,
          name: item.name,
          unit: item.unit,
          quantityOnHand: balances.get(item.id) ?? "0.000",
        })),
      recentEvents: eventRows.slice(0, 50).map((row) => ({
        ...row,
        itemName:
          itemById.get(row.inventoryItemId)?.name ?? "Archived inventory item",
      })),
      movementPage,
      hasMoreMovements: eventRows.length > 50,
      cashDeductions: cashRows,
      adjustments: adjustmentRows.map((row) => ({
        ...row,
        itemName:
          itemById.get(row.inventoryItemId)?.name ?? "Archived inventory item",
        unit: itemById.get(row.inventoryItemId)?.unit ?? "",
      })),
    },
  };
}

export type InventoryWorkspaceData = Awaited<
  ReturnType<typeof getInventoryWorkspace>
>;
export type InventorySelection = NonNullable<
  InventoryWorkspaceData["selected"]
>;
