import type { PreparedOperationContext } from "./offline-context";
import { randomUUID } from "node:crypto";

import {
  inventoryBalances,
  inventoryEventLines,
  inventoryEvents,
  inventoryItems,
} from "@miniros/db/schema";
import { formatQuantity, normalizeQuantity } from "@miniros/domain";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { AccessError } from "./access";
import type { OperationalTransaction } from "./operational-helpers";

type InventoryDelta = {
  inventoryItemId: string;
  quantityDelta: number | string;
  unit?: string;
};

export function databaseQuantity(value: number | string) {
  return formatQuantity(normalizeQuantity(value));
}

export async function loadOperationalInventoryItems(
  tx: OperationalTransaction,
  businessId: string,
  requestedIds: readonly string[],
  prepared?: PreparedOperationContext,
) {
  const uniqueIds = [...new Set(requestedIds)].sort();
  if (uniqueIds.length !== requestedIds.length) {
    throw new AccessError("Each inventory item may appear only once.");
  }
  if (uniqueIds.length === 0) {
    throw new AccessError("At least one inventory item is required.");
  }

  const rows = prepared
    ? prepared.snapshot.inventory.filter((item) => uniqueIds.includes(item.id))
    : await tx
        .select({
          id: inventoryItems.id,
          unit: inventoryItems.unit,
          defaultUnitCostCents: inventoryItems.defaultUnitCostCents,
        })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.businessId, businessId),
            inArray(inventoryItems.id, uniqueIds),
            eq(inventoryItems.status, "active"),
            isNull(inventoryItems.deletedAt),
          ),
        );

  if (rows.length !== uniqueIds.length) {
    throw new AccessError("One or more inventory items are unavailable.");
  }
  return new Map(rows.map((row) => [row.id, row]));
}

export async function applyInventoryDeltas(
  tx: OperationalTransaction,
  input: {
    businessId: string;
    shiftId: string | null;
    inventoryLocationId: string;
    eventId: string;
    eventType:
      | "sale_deduction"
      | "production_input"
      | "production_output"
      | "adjustment"
      | "receiving"
      | "transfer_in"
      | "transfer_out";
    sourceType: string;
    sourceId: string;
    employeeId: string | null;
    notes?: string | null;
    lines: readonly InventoryDelta[];
    prepared?: PreparedOperationContext;
  },
) {
  const itemById = await loadOperationalInventoryItems(
    tx,
    input.businessId,
    input.lines.map((line) => line.inventoryItemId),
    input.prepared,
  );
  const now = input.prepared?.occurredAt ?? new Date();

  await tx.insert(inventoryEvents).values({
    id: input.eventId,
    businessId: input.businessId,
    shiftId: input.shiftId,
    inventoryLocationId: input.inventoryLocationId,
    eventType: input.eventType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    notes: input.notes,
    createdBy: input.employeeId,
    clientGeneratedId: input.eventId,
    createdAt: now,
  });

  const eventLines = [];
  for (const line of [...input.lines].sort((left, right) =>
    left.inventoryItemId.localeCompare(right.inventoryItemId),
  )) {
    const item = itemById.get(line.inventoryItemId);
    if (!item) throw new AccessError("Inventory item not found.");
    if (line.unit && line.unit !== item.unit) {
      throw new AccessError("A recipe unit does not match its inventory item.");
    }
    const delta = databaseQuantity(line.quantityDelta);
    if (normalizeQuantity(delta) === 0) {
      throw new AccessError("Inventory changes must not be zero.");
    }

    const [balance] = await tx
      .insert(inventoryBalances)
      .values({
        id: randomUUID(),
        businessId: input.businessId,
        inventoryLocationId: input.inventoryLocationId,
        inventoryItemId: line.inventoryItemId,
        quantityOnHand: delta,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          inventoryBalances.businessId,
          inventoryBalances.inventoryLocationId,
          inventoryBalances.inventoryItemId,
        ],
        set: {
          quantityOnHand: sql`${inventoryBalances.quantityOnHand} + ${delta}::numeric`,
          updatedAt: now,
        },
      })
      .returning({ quantityOnHand: inventoryBalances.quantityOnHand });

    if (!balance || normalizeQuantity(balance.quantityOnHand) < 0) {
      throw new AccessError(
        `Insufficient inventory for ${line.inventoryItemId}.`,
      );
    }
    eventLines.push({
      id: randomUUID(),
      businessId: input.businessId,
      eventId: input.eventId,
      inventoryItemId: line.inventoryItemId,
      quantityDelta: delta,
      unit: item.unit,
      unitCostCents: item.defaultUnitCostCents,
      balanceAfter: balance.quantityOnHand,
    });
  }

  await tx.insert(inventoryEventLines).values(eventLines);
}
