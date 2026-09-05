import { assertUnreservedShift } from "./offline-context";
import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  inventoryItems,
  inventoryLocations,
  stockReceivingLines,
  stockReceivings,
  stockTransferLines,
  stockTransfers,
} from "@miniros/db/schema";
import { normalizeQuantity } from "@miniros/domain";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import { applyInventoryDeltas, databaseQuantity } from "./inventory-ledger";
import type { OperationalTransaction } from "./operational-helpers";

type StockLine = {
  inventoryItemId: string;
  quantity: number | string;
};

export async function listStockWorkspace() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const [locations, items, receivings, transfers] = await Promise.all([
    database
      .select({
        id: inventoryLocations.id,
        name: inventoryLocations.name,
        locationType: inventoryLocations.locationType,
      })
      .from(inventoryLocations)
      .where(
        and(
          eq(inventoryLocations.businessId, business.id),
          eq(inventoryLocations.status, "active"),
          isNull(inventoryLocations.deletedAt),
        ),
      )
      .orderBy(asc(inventoryLocations.name)),
    database
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.businessId, business.id),
          eq(inventoryItems.status, "active"),
          eq(inventoryItems.trackStock, true),
          isNull(inventoryItems.deletedAt),
        ),
      )
      .orderBy(asc(inventoryItems.name)),
    database
      .select({
        id: stockReceivings.id,
        locationId: stockReceivings.inventoryLocationId,
        referenceNumber: stockReceivings.referenceNumber,
        receivedAt: stockReceivings.receivedAt,
      })
      .from(stockReceivings)
      .where(eq(stockReceivings.businessId, business.id))
      .orderBy(desc(stockReceivings.receivedAt))
      .limit(10),
    database
      .select({
        id: stockTransfers.id,
        fromLocationId: stockTransfers.fromInventoryLocationId,
        toLocationId: stockTransfers.toInventoryLocationId,
        transferredAt: stockTransfers.transferredAt,
      })
      .from(stockTransfers)
      .where(eq(stockTransfers.businessId, business.id))
      .orderBy(desc(stockTransfers.transferredAt))
      .limit(10),
  ]);

  const [receivingLines, transferLines] = await Promise.all([
    receivings.length
      ? database
          .select({
            recordId: stockReceivingLines.stockReceivingId,
            id: stockReceivingLines.id,
            itemName: inventoryItems.name,
            quantity: stockReceivingLines.quantity,
            unit: stockReceivingLines.unit,
          })
          .from(stockReceivingLines)
          .leftJoin(
            inventoryItems,
            and(
              eq(inventoryItems.id, stockReceivingLines.inventoryItemId),
              eq(inventoryItems.businessId, business.id),
            ),
          )
          .where(
            and(
              eq(stockReceivingLines.businessId, business.id),
              inArray(
                stockReceivingLines.stockReceivingId,
                receivings.map((row) => row.id),
              ),
            ),
          )
      : Promise.resolve([]),
    transfers.length
      ? database
          .select({
            recordId: stockTransferLines.stockTransferId,
            id: stockTransferLines.id,
            itemName: inventoryItems.name,
            quantity: stockTransferLines.quantity,
            unit: stockTransferLines.unit,
          })
          .from(stockTransferLines)
          .leftJoin(
            inventoryItems,
            and(
              eq(inventoryItems.id, stockTransferLines.inventoryItemId),
              eq(inventoryItems.businessId, business.id),
            ),
          )
          .where(
            and(
              eq(stockTransferLines.businessId, business.id),
              inArray(
                stockTransferLines.stockTransferId,
                transfers.map((row) => row.id),
              ),
            ),
          )
      : Promise.resolve([]),
  ]);
  return {
    businessId: business.id,
    locations,
    items,
    receivings: receivings.map((row) => ({
      ...row,
      lines: receivingLines.filter((line) => line.recordId === row.id),
    })),
    transfers: transfers.map((row) => ({
      ...row,
      lines: transferLines.filter((line) => line.recordId === row.id),
    })),
  };
}

export async function createCentralInventoryLocation(name: string) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const id = randomUUID();
  return database.transaction(async (tx) => {
    const [created] = await tx
      .insert(inventoryLocations)
      .values({
        id,
        businessId: access.business.id,
        name: name.trim(),
        locationType: "central",
        status: "active",
      })
      .returning({ id: inventoryLocations.id, name: inventoryLocations.name });

    if (!created) throw new Error("Inventory location was not created.");
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "inventory_location.created",
      entityType: "inventory_location",
      entityId: id,
      metadata: { name: created.name, locationType: "central" },
    });
    return created;
  });
}

async function validateStockLines(
  database: OperationalTransaction,
  businessId: string,
  lines: readonly StockLine[],
  requirePositive: boolean,
) {
  if (lines.length === 0) throw new AccessError("Add at least one stock line.");
  const itemIds = lines.map((line) => line.inventoryItemId);
  if (new Set(itemIds).size !== itemIds.length) {
    throw new AccessError("Each inventory item may appear only once.");
  }
  const items = await database
    .select({ id: inventoryItems.id, unit: inventoryItems.unit })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.businessId, businessId),
        eq(inventoryItems.status, "active"),
        eq(inventoryItems.trackStock, true),
        isNull(inventoryItems.deletedAt),
      ),
    );
  const itemById = new Map(items.map((item) => [item.id, item]));
  return lines.map((line) => {
    const item = itemById.get(line.inventoryItemId);
    if (!item)
      throw new AccessError("One or more stock items are unavailable.");
    const quantity = normalizeQuantity(line.quantity);
    if (requirePositive ? quantity <= 0 : quantity === 0) {
      throw new AccessError("Stock quantities must be positive.");
    }
    return {
      inventoryItemId: item.id,
      quantity,
      unit: item.unit,
    };
  });
}

async function requireLocation(
  businessId: string,
  locationId: string,
  database: OperationalTransaction,
) {
  const [location] = await database
    .select({ id: inventoryLocations.id, shiftId: inventoryLocations.shiftId })
    .from(inventoryLocations)
    .where(
      and(
        eq(inventoryLocations.id, locationId),
        eq(inventoryLocations.businessId, businessId),
        eq(inventoryLocations.status, "active"),
        isNull(inventoryLocations.deletedAt),
      ),
    )
    .limit(1);
  if (!location) throw new AccessError("Inventory location not found.");
  if (location.shiftId)
    await assertUnreservedShift(database, businessId, location.shiftId);
  return location;
}

export async function receiveStock(input: {
  receivingId: string;
  inventoryEventId: string;
  inventoryLocationId: string;
  referenceNumber: string | null;
  notes: string | null;
  lines: readonly StockLine[];
}) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  return database.transaction(async (tx) => {
    await requireLocation(access.business.id, input.inventoryLocationId, tx);
    const lines = await validateStockLines(
      tx,
      access.business.id,
      input.lines,
      true,
    );
    const [created] = await tx
      .insert(stockReceivings)
      .values({
        id: input.receivingId,
        businessId: access.business.id,
        inventoryLocationId: input.inventoryLocationId,
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        receivedBy: access.employee?.id ?? null,
        clientGeneratedId: input.receivingId,
      })
      .onConflictDoNothing({
        target: [stockReceivings.businessId, stockReceivings.clientGeneratedId],
      })
      .returning({ id: stockReceivings.id });
    if (!created) return { id: input.receivingId, idempotent: true };

    await tx.insert(stockReceivingLines).values(
      lines.map((line) => ({
        id: randomUUID(),
        businessId: access.business.id,
        stockReceivingId: input.receivingId,
        inventoryItemId: line.inventoryItemId,
        quantity: databaseQuantity(line.quantity),
        unit: line.unit,
      })),
    );
    await applyInventoryDeltas(tx, {
      businessId: access.business.id,
      shiftId: null,
      inventoryLocationId: input.inventoryLocationId,
      eventId: input.inventoryEventId,
      eventType: "receiving",
      sourceType: "stock_receiving",
      sourceId: input.receivingId,
      employeeId: access.employee?.id ?? null,
      notes: input.notes,
      lines: lines.map((line) => ({
        inventoryItemId: line.inventoryItemId,
        quantityDelta: line.quantity,
        unit: line.unit,
      })),
    });
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "stock.received",
      entityType: "stock_receiving",
      entityId: input.receivingId,
      metadata: {
        inventoryEventId: input.inventoryEventId,
        lineCount: lines.length,
      },
    });
    return { id: input.receivingId, idempotent: false };
  });
}

export async function transferStock(input: {
  transferId: string;
  transferOutEventId: string;
  transferInEventId: string;
  fromInventoryLocationId: string;
  toInventoryLocationId: string;
  notes: string | null;
  lines: readonly StockLine[];
}) {
  const access = await requireActiveBusiness({ admin: true });
  if (input.fromInventoryLocationId === input.toInventoryLocationId) {
    throw new AccessError("Choose two different inventory locations.");
  }
  const database = requireDatabase();
  return database.transaction(async (tx) => {
    await requireLocation(
      access.business.id,
      input.fromInventoryLocationId,
      tx,
    );
    await requireLocation(access.business.id, input.toInventoryLocationId, tx);
    const lines = await validateStockLines(
      tx,
      access.business.id,
      input.lines,
      true,
    );
    const [created] = await tx
      .insert(stockTransfers)
      .values({
        id: input.transferId,
        businessId: access.business.id,
        fromInventoryLocationId: input.fromInventoryLocationId,
        toInventoryLocationId: input.toInventoryLocationId,
        notes: input.notes,
        status: "completed",
        transferredBy: access.employee?.id ?? null,
        clientGeneratedId: input.transferId,
      })
      .onConflictDoNothing({
        target: [stockTransfers.businessId, stockTransfers.clientGeneratedId],
      })
      .returning({ id: stockTransfers.id });
    if (!created) return { id: input.transferId, idempotent: true };

    await tx.insert(stockTransferLines).values(
      lines.map((line) => ({
        id: randomUUID(),
        businessId: access.business.id,
        stockTransferId: input.transferId,
        inventoryItemId: line.inventoryItemId,
        quantity: databaseQuantity(line.quantity),
        unit: line.unit,
      })),
    );
    const transferLines = lines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      quantityDelta: line.quantity,
      unit: line.unit,
    }));
    await applyInventoryDeltas(tx, {
      businessId: access.business.id,
      shiftId: null,
      inventoryLocationId: input.fromInventoryLocationId,
      eventId: input.transferOutEventId,
      eventType: "transfer_out",
      sourceType: "stock_transfer",
      sourceId: input.transferId,
      employeeId: access.employee?.id ?? null,
      notes: input.notes,
      lines: transferLines.map((line) => ({
        ...line,
        quantityDelta: -line.quantityDelta,
      })),
    });
    await applyInventoryDeltas(tx, {
      businessId: access.business.id,
      shiftId: null,
      inventoryLocationId: input.toInventoryLocationId,
      eventId: input.transferInEventId,
      eventType: "transfer_in",
      sourceType: "stock_transfer",
      sourceId: input.transferId,
      employeeId: access.employee?.id ?? null,
      notes: input.notes,
      lines: transferLines,
    });
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "stock.transferred",
      entityType: "stock_transfer",
      entityId: input.transferId,
      metadata: {
        transferOutEventId: input.transferOutEventId,
        transferInEventId: input.transferInEventId,
        lineCount: lines.length,
      },
    });
    return { id: input.transferId, idempotent: false };
  });
}
