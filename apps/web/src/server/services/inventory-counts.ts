import type { PreparedOperationContext } from "./offline-context";
import { randomUUID } from "node:crypto";

import {
  inventoryBalances,
  inventoryEventLines,
  inventoryEvents,
  shiftInventoryCounts,
} from "@miniros/db/schema";
import { normalizeQuantity } from "@miniros/domain";
import { and, eq, inArray } from "drizzle-orm";

import { AccessError } from "./access";
import {
  databaseQuantity,
  loadOperationalInventoryItems,
} from "./inventory-ledger";
import type { OperationalTransaction } from "./operational-helpers";

export async function setInventoryCounts(
  tx: OperationalTransaction,
  input: {
    businessId: string;
    shiftId: string;
    inventoryLocationId: string;
    eventId: string;
    countType: "opening" | "closing";
    employeeId: string;
    notes?: string | null;
    prepared?: PreparedOperationContext;
    counts: readonly {
      inventoryItemId: string;
      quantity: number | string;
    }[];
  },
) {
  const itemById = await loadOperationalInventoryItems(
    tx,
    input.businessId,
    input.counts.map((count) => count.inventoryItemId),
    input.prepared,
  );
  const itemIds = [...itemById.keys()].sort();
  const previousBalances = await tx
    .select({
      inventoryItemId: inventoryBalances.inventoryItemId,
      quantityOnHand: inventoryBalances.quantityOnHand,
    })
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.businessId, input.businessId),
        eq(inventoryBalances.inventoryLocationId, input.inventoryLocationId),
        inArray(inventoryBalances.inventoryItemId, itemIds),
      ),
    )
    .for("update");
  const previousByItem = new Map(
    previousBalances.map((row) => [row.inventoryItemId, row.quantityOnHand]),
  );
  const countsByItem = new Map(
    input.counts.map((count) => [
      count.inventoryItemId,
      databaseQuantity(count.quantity),
    ]),
  );
  const now = input.prepared?.occurredAt ?? new Date();
  for (const quantity of countsByItem.values()) {
    if (normalizeQuantity(quantity) < 0) {
      throw new AccessError("Inventory counts must not be negative.");
    }
  }

  await tx.insert(inventoryEvents).values({
    id: input.eventId,
    businessId: input.businessId,
    shiftId: input.shiftId,
    inventoryLocationId: input.inventoryLocationId,
    eventType:
      input.countType === "opening" ? "opening_count" : "closeout_count",
    sourceType: "shift",
    sourceId: input.shiftId,
    notes: input.notes,
    createdBy: input.employeeId,
    clientGeneratedId: input.eventId,
    createdAt: now,
  });

  const countRows = [];
  const eventLines = [];
  for (const inventoryItemId of itemIds) {
    const item = itemById.get(inventoryItemId);
    const quantity = countsByItem.get(inventoryItemId);
    if (!item || quantity === undefined) {
      throw new AccessError("Inventory item not found.");
    }
    const previous = previousByItem.get(inventoryItemId) ?? "0";
    const delta = databaseQuantity(
      normalizeQuantity(quantity) - normalizeQuantity(previous),
    );

    await tx
      .insert(inventoryBalances)
      .values({
        id: randomUUID(),
        businessId: input.businessId,
        inventoryLocationId: input.inventoryLocationId,
        inventoryItemId,
        quantityOnHand: quantity,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          inventoryBalances.businessId,
          inventoryBalances.inventoryLocationId,
          inventoryBalances.inventoryItemId,
        ],
        set: { quantityOnHand: quantity, updatedAt: now },
      });
    countRows.push({
      id: randomUUID(),
      businessId: input.businessId,
      shiftId: input.shiftId,
      inventoryItemId,
      countType: input.countType,
      countedQuantity: quantity,
      unit: item.unit,
      countedBy: input.employeeId,
      countedAt: now,
    });
    eventLines.push({
      id: randomUUID(),
      businessId: input.businessId,
      eventId: input.eventId,
      inventoryItemId,
      quantityDelta: delta,
      unit: item.unit,
      unitCostCents: item.defaultUnitCostCents,
      balanceAfter: quantity,
    });
  }

  await tx.insert(shiftInventoryCounts).values(countRows);
  await tx.insert(inventoryEventLines).values(eventLines);
}
