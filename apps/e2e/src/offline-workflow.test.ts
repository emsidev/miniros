import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import * as tables from "@miniros/db/schema";
import type { Database } from "@miniros/db";
import {
  offlineOperationSchema,
  type OfflineEnvelope,
} from "@miniros/contracts";
import {
  preparedFixture,
  opening,
  sale,
  closeout,
  uuid,
} from "@/test/offline-fixture";
import {
  ShiftStore,
  appendShiftAction,
  savePreparedShift,
} from "@/lib/offline/store";
const context = vi.hoisted(() => ({
  db: null as unknown as Database,
  access: null as unknown as Record<string, unknown>,
  device: "test-device",
  storageId: "00000000-0000-4000-8000-000000000001",
  revoked: false,
  objects: new Map<string, Blob>(),
  loseUploadAck: false,
  afterUpload: null as (() => Promise<void>) | null,
}));
vi.mock("@miniros/db", async (original) => ({
  ...(await original<typeof import("@miniros/db")>()),
  requireDatabase: () => context.db,
}));
vi.mock("@/server/services/access", async () => {
  const { AccessError } = await import("@/server/services/access-error");
  return {
    AccessError,
    requireActiveBusiness: async () => {
      if (context.revoked) throw new AccessError("Access revoked");
      return context.access;
    },
  };
});
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-miniros-storage": context.storageId }),
  cookies: async () => ({
    get: () => ({ value: context.device }),
    set: () => {},
  }),
}));
vi.mock("@/server/services/offline-prepare", async (original) => ({
  ...(await original<typeof import("@/server/services/offline-prepare")>()),
  installationId: async () => context.device,
}));
vi.mock("@/lib/supabase/storage-admin", () => ({
  createStorageAdmin: () => ({
    storage: {
      from: () => ({
        upload: async (path: string, file: File) => {
          if (context.objects.has(path))
            return { error: new Error("Already uploaded") };
          context.objects.set(path, file);
          const afterUpload = context.afterUpload;
          context.afterUpload = null;
          await afterUpload?.();
          if (context.loseUploadAck) {
            context.loseUploadAck = false;
            return { error: new Error("Acknowledgement lost") };
          }
          return { error: null };
        },
        download: async (path: string) => ({
          data: context.objects.get(path) ?? null,
          error: null,
        }),
      }),
    },
  }),
}));
import { attachPaymentProof } from "@/server/services/payment-proofs";
import { prepareOfflineShift } from "@/server/services/offline-prepare";
import {
  getOfflineAdministration,
  offlineRecoveryJournal,
  recoverOfflineDevice,
} from "@/server/services/offline-admin";
import { synchronizeOfflineAction } from "@/server/services/offline-sync";
import { attachDiscountProof } from "@/server/services/discount-proofs";
import { createPromo } from "@/server/services/promos";
import { finalizeSale } from "@/server/services/sales-operations";
import {
  reviewCashDeduction,
  submitCashDeduction,
} from "@/server/services/cash-deduction-operations";
import {
  reviewInventoryAdjustment,
  submitInventoryAdjustment,
} from "@/server/services/inventory-adjustment-operations";
import { setInventoryCounts } from "@/server/services/inventory-counts";
import { startAssignedShift } from "@/server/services/shift-start";
import { submitShiftCloseout } from "@/server/services/shift-closeout";
import {
  createInventoryItem,
  updateInventoryItem,
  softDeleteInventoryItem,
} from "@/server/services/inventory-items";
const pg = new PGlite();
const db = drizzle(pg, { schema: tables });
beforeAll(async () => {
  await pg.exec(
    "create schema auth; create table auth.users (id uuid primary key); create role anon; create role authenticated; create role service_role; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;",
  );
  await pg.exec(
    "create schema storage; create table storage.objects (id uuid primary key, bucket_id text, name text); alter table storage.objects enable row level security;",
  );
  for (const name of [
    "20260828212149_initial_public_schema",
    "20260828212202_row_level_security",
    "20260828212205_data_api_grants",
    "20260902063702_catalog_safety_navigation",
    "20260902064344_powerful_the_captain",
    "20260902065424_standalone_production_finished_goods",
    "20260902080000_automatic_recipe_unit_cost",
    "20260905022136_shift_draft_statuses",
    "20260905022223_shift_draft_privacy",
    "20260905040950_offline_shift_sessions",
    "20260905062610_pos_discount_photos",
  ]) {
    await pg.exec(
      readFileSync(
        resolve(process.cwd(), `../../supabase/migrations/${name}.sql`),
        "utf8",
      ),
    );
  }
  context.db = db as unknown as Database;
}, 60000);
afterAll(async () => {
  await pg.close();
});
async function fixture() {
  const prepared = preparedFixture();
  const s = prepared.snapshot;
  const locationId = uuid(),
    categoryId = uuid(),
    memberId = uuid();
  await db.insert(tables.authUsers).values({ id: s.userId });
  await db
    .insert(tables.businesses)
    .values({ id: s.businessId, name: s.businessName, createdBy: s.userId });
  await db.insert(tables.businessMembers).values({
    id: memberId,
    businessId: s.businessId,
    authUserId: s.userId,
    role: "owner",
    status: "active",
  });
  await db.insert(tables.employees).values({
    id: s.employeeId,
    businessId: s.businessId,
    memberId,
    displayName: "Pilot operator",
    canUsePos: true,
  });
  await db
    .insert(tables.sellingLocations)
    .values({ id: locationId, businessId: s.businessId, name: s.locationName });
  await db.insert(tables.shifts).values({
    id: s.shiftId,
    businessId: s.businessId,
    sellingLocationId: locationId,
    shiftDate: s.shiftDate,
  });
  await db.insert(tables.shiftAssignments).values({
    id: uuid(),
    businessId: s.businessId,
    shiftId: s.shiftId,
    employeeId: s.employeeId,
    salaryRateCents: 800,
  });
  await db
    .insert(tables.productCategories)
    .values({ id: categoryId, businessId: s.businessId, name: "Drinks" });
  await db.insert(tables.inventoryItems).values({
    ...s.inventory[0]!,
    businessId: s.businessId,
    sku: uuid(),
    itemType: "packaging",
    unit: "pcs",
  });
  await db.insert(tables.products).values({
    ...s.products[0]!,
    businessId: s.businessId,
    categoryId,
    sku: uuid(),
  });
  await db.insert(tables.productRecipeItems).values({
    id: uuid(),
    businessId: s.businessId,
    productId: s.products[0]!.id,
    inventoryItemId: s.inventory[0]!.id,
    quantity: "1",
    unit: "pcs",
  });
  await db
    .insert(tables.offlinePilots)
    .values({ businessId: s.businessId, locationId, enabled: true });
  await db.insert(tables.offlineShiftSessions).values({
    id: prepared.id,
    businessId: s.businessId,
    shiftId: s.shiftId,
    userId: s.userId,
    deviceId: prepared.deviceId,
    snapshotId: s.id,
    snapshot: s,
  });
  context.access = {
    user: { id: s.userId },
    employee: { id: s.employeeId, canUsePos: true },
    business: { id: s.businessId, name: s.businessName, features: s.features },
    membership: { role: "owner" },
  };
  context.device = prepared.deviceId;
  context.storageId = s.storageInstallationId;
  context.revoked = false;
  const local = new ShiftStore(uuid());
  await local.meta.put({
    id: "storageInstallationId",
    value: s.storageInstallationId,
  });
  await savePreparedShift(
    prepared,
    { userId: s.userId, businessId: s.businessId, deviceId: prepared.deviceId },
    local,
  );
  const append = async (operation: Parameters<typeof appendShiftAction>[1]) => {
    const envelope = await appendShiftAction(
      prepared.id,
      operation,
      uuid(),
      [],
      local,
    );
    return {
      schemaVersion: envelope.schemaVersion,
      id: envelope.id,
      sessionId: envelope.sessionId,
      snapshotId: envelope.snapshotId,
      sequence: envelope.sequence,
      occurredAt: envelope.occurredAt,
      operation: envelope.operation,
    } as OfflineEnvelope;
  };
  return { prepared, s, local, append };
}

// Existing online shifts must remain finishable after preparation becomes mandatory.
async function seedHistoricalActiveShift(
  prepared: ReturnType<typeof preparedFixture>,
) {
  const snapshot = prepared.snapshot;
  const started = opening(prepared);
  if (started.type !== "START_SHIFT") throw new Error();
  await context.db.transaction(async (tx) => {
    const [shift] = await tx
      .select({ sellingLocationId: tables.shifts.sellingLocationId })
      .from(tables.shifts)
      .where(eq(tables.shifts.id, snapshot.shiftId))
      .limit(1);
    if (!shift) throw new Error("Missing fixture shift");
    await tx
      .delete(tables.offlineShiftSessions)
      .where(eq(tables.offlineShiftSessions.id, prepared.id));
    await tx.insert(tables.inventoryLocations).values({
      id: snapshot.inventoryLocationId,
      businessId: snapshot.businessId,
      sellingLocationId: shift.sellingLocationId,
      shiftId: snapshot.shiftId,
      name: "Historical shift inventory",
      locationType: "shift",
      status: "active",
    });
    await setInventoryCounts(tx, {
      businessId: snapshot.businessId,
      shiftId: snapshot.shiftId,
      inventoryLocationId: snapshot.inventoryLocationId,
      eventId: started.payload.openingEventId,
      countType: "opening",
      employeeId: snapshot.employeeId,
      counts: started.payload.counts,
    });
    await tx
      .update(tables.shifts)
      .set({
        status: "active",
        actualStartAt: new Date(),
        startedBy: snapshot.employeeId,
      })
      .where(eq(tables.shifts.id, snapshot.shiftId));
  });
}

describe("offline shift PostgreSQL reconciliation", () => {
  it("reconciles a manual discount with saved promos disabled", async () => {
    const { prepared, s, local, append } = await fixture();
    try {
      s.features.promosEnabled = false;
      await db
        .update(tables.offlineShiftSessions)
        .set({ snapshot: s })
        .where(eq(tables.offlineShiftSessions.id, prepared.id));
      await local.sessions.update(prepared.id, { snapshot: s });
      await synchronizeOfflineAction(await append(opening(prepared)));
      const discounted = sale(prepared);
      if (discounted.type !== "CREATE_SALE") throw new Error();
      discounted.payload.items[0]!.discountCents = 1000;
      expect(
        await synchronizeOfflineAction(await append(discounted)),
      ).toMatchObject({
        ok: true,
        result: { totalCents: 19000, changeCents: 6000 },
      });
      expect((await local.sessions.get(prepared.id))?.projection).toMatchObject(
        {
          salesCents: 19000,
          cashCents: 19000,
        },
      );
      expect(
        await synchronizeOfflineAction(await append(closeout(prepared, 19000))),
      ).toMatchObject({
        ok: true,
        sessionStatus: "closed",
        result: {
          expectedCashCents: 19000,
          cashDifferenceCents: 0,
          profitCents: 11000,
        },
      });
    } finally {
      await local.delete();
    }
  });

  it("blocks online closeout until both cash and inventory requests are reviewed", async () => {
    const { prepared, s, local } = await fixture();
    try {
      s.features.approvalsEnabled = true;
      const sold = sale(prepared);
      const closed = closeout(prepared, 19000, 7);
      if (sold.type !== "CREATE_SALE" || closed.type !== "SUBMIT_CLOSEOUT")
        throw new Error();
      await seedHistoricalActiveShift(prepared);
      await finalizeSale(sold.payload);
      const deductionId = uuid();
      await submitCashDeduction({
        deductionId,
        shiftId: s.shiftId,
        label: "Ice",
        amountCents: 1000,
      });
      const adjustmentId = uuid();
      await submitInventoryAdjustment({
        adjustmentId,
        inventoryEventId: uuid(),
        shiftId: s.shiftId,
        inventoryItemId: s.inventory[0]!.id,
        quantityDelta: -1,
        reason: "Damaged cup",
      });
      await expect(submitShiftCloseout(closed.payload)).rejects.toThrow(
        /review/i,
      );
      expect(
        await db
          .select()
          .from(tables.shiftProfitSummaries)
          .where(eq(tables.shiftProfitSummaries.shiftId, s.shiftId)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(tables.shiftCloseouts)
          .where(eq(tables.shiftCloseouts.shiftId, s.shiftId)),
      ).toHaveLength(0);
      await reviewCashDeduction({ deductionId, decision: "approved" });
      await expect(submitShiftCloseout(closed.payload)).rejects.toThrow(
        /review/i,
      );
      await reviewInventoryAdjustment({
        adjustmentId,
        inventoryEventId: uuid(),
        decision: "approved",
      });
      expect(await submitShiftCloseout(closed.payload)).toMatchObject({
        expectedCashCents: 19000,
        cashDifferenceCents: 0,
        profitCents: 12200,
      });
    } finally {
      await local.delete();
    }
  });

  it("replays a cold-reopened shift once with frozen prices, times, stock, cash and profit", async () => {
    const { prepared, s, local, append } = await fixture();
    try {
      const start = await append(opening(prepared));
      const sold = await append(sale(prepared));
      const closed = await append(closeout(prepared));
      local.close();
      await local.open();
      await db
        .update(tables.products)
        .set({ priceCents: 99999, costCents: 90000 })
        .where(eq(tables.products.id, s.products[0]!.id));
      const first = await synchronizeOfflineAction(start);
      expect(first.ok).toBe(true);
      expect(await synchronizeOfflineAction(start)).toEqual(first);
      const receipt = await synchronizeOfflineAction(sold);
      expect(receipt).toMatchObject({
        ok: true,
        result: { totalCents: 20000, changeCents: 5000 },
      });
      expect(await synchronizeOfflineAction(sold)).toEqual(receipt);
      const result = await synchronizeOfflineAction(closed);
      expect(result).toMatchObject({
        ok: true,
        sessionStatus: "closed",
        result: {
          expectedCashCents: 20000,
          cashDifferenceCents: 0,
          profitCents: 12000,
        },
      });
      expect(await synchronizeOfflineAction(closed)).toEqual(result);
      expect(
        await db
          .select()
          .from(tables.sales)
          .where(eq(tables.sales.shiftId, s.shiftId)),
      ).toHaveLength(1);
      expect(
        await db
          .select()
          .from(tables.offlineSyncActions)
          .where(eq(tables.offlineSyncActions.sessionId, prepared.id)),
      ).toHaveLength(3);
      const [shift] = await db
        .select()
        .from(tables.shifts)
        .where(eq(tables.shifts.id, s.shiftId));
      expect(shift?.actualStartAt?.toISOString()).toBe(start.occurredAt);
      expect(shift?.actualEndAt?.toISOString()).toBe(closed.occurredAt);
      expect(
        (
          await db
            .select()
            .from(tables.inventoryBalances)
            .where(
              eq(
                tables.inventoryBalances.inventoryLocationId,
                s.inventoryLocationId,
              ),
            )
        )[0]?.quantityOnHand,
      ).toBe("8.000");
    } finally {
      await local.delete();
    }
  });
  it("rejects a second device, normal online writes, missing sequences and mutated IDs", async () => {
    const { prepared, s, local, append } = await fixture();
    try {
      const start = await append(opening(prepared));
      const sold = await append(sale(prepared));
      const originalStorage = context.storageId;
      context.storageId = uuid();
      await expect(synchronizeOfflineAction(start)).rejects.toThrow("device");
      context.storageId = originalStorage;
      context.device = "different-device";
      await expect(synchronizeOfflineAction(start)).rejects.toThrow("device");
      context.device = prepared.deviceId;
      expect(await synchronizeOfflineAction(sold)).toMatchObject({
        ok: false,
        code: "CONFLICT",
      });
      await synchronizeOfflineAction(start);
      if (sold.operation.type !== "CREATE_SALE") throw new Error();
      await expect(finalizeSale(sold.operation.payload)).rejects.toThrow(
        "prepared device",
      );
      await synchronizeOfflineAction(sold);
      const changed = structuredClone(sold);
      if (changed.operation.type === "CREATE_SALE")
        changed.operation.payload.items[0]!.discountCents = 1;
      expect(await synchronizeOfflineAction(changed)).toMatchObject({
        ok: false,
        code: "CONFLICT",
      });
      context.revoked = true;
      await expect(synchronizeOfflineAction(sold)).rejects.toThrow("revoked");
      context.revoked = false;
      expect(
        await db
          .select()
          .from(tables.sales)
          .where(eq(tables.sales.shiftId, s.shiftId)),
      ).toHaveLength(1);
    } finally {
      await local.delete();
    }
  });
  it("seals closeout until approvals resolve and then uses approved costs", async () => {
    const { prepared, s, local, append } = await fixture();
    try {
      await synchronizeOfflineAction(await append(opening(prepared)));
      await synchronizeOfflineAction(await append(sale(prepared)));
      const deductionId = uuid();
      const request = offlineOperationSchema.parse({
        type: "CREATE_CASH_DEDUCTION",
        payload: {
          deductionId,
          shiftId: s.shiftId,
          amountCents: 1000,
          label: "Ice",
          reason: "Cash paid",
        },
      });
      await synchronizeOfflineAction(await append(request));
      const closed = await append(closeout(prepared, 19000));
      expect(await synchronizeOfflineAction(closed)).toMatchObject({
        ok: false,
        code: "WAITING_REVIEW",
      });
      expect(
        await db
          .select()
          .from(tables.shiftProfitSummaries)
          .where(eq(tables.shiftProfitSummaries.shiftId, s.shiftId)),
      ).toHaveLength(0);
      const changed = structuredClone(closed);
      if (changed.operation.type === "SUBMIT_CLOSEOUT")
        changed.operation.payload.actualCashCents = 0;
      expect(await synchronizeOfflineAction(changed)).toMatchObject({
        ok: false,
        code: "CONFLICT",
      });
      await reviewCashDeduction({ deductionId, decision: "approved" });
      expect(await synchronizeOfflineAction(closed)).toMatchObject({
        ok: true,
        result: { expectedCashCents: 19000, profitCents: 11000 },
      });
    } finally {
      await local.delete();
    }
  });
  it("keeps unavailable proofs visible and does not finalize profit", async () => {
    const { prepared, s, local, append } = await fixture();
    try {
      await synchronizeOfflineAction(await append(opening(prepared)));
      const sold = await append(sale(prepared));
      if (sold.operation.type !== "CREATE_SALE") throw new Error();
      const payment = sold.operation.payload.payments[0]!;
      payment.paymentMethod = "gcash";
      payment.amountCents = 20000;
      payment.referenceNumber = "TEST-REF";
      sold.operation.proofs = [
        {
          fileId: uuid(),
          paymentId: payment.id,
          name: "proof.pdf",
          size: 100,
          mimeType: "application/pdf",
        },
      ];
      expect(await synchronizeOfflineAction(sold)).toMatchObject({ ok: true });
      const closed = await append(closeout(prepared, 0));
      expect(await synchronizeOfflineAction(closed)).toMatchObject({
        ok: false,
        code: "PROOF_PENDING",
      });
      expect(
        await db
          .select()
          .from(tables.shiftProfitSummaries)
          .where(eq(tables.shiftProfitSummaries.shiftId, s.shiftId)),
      ).toHaveLength(0);
    } finally {
      await local.delete();
    }
  });
  it("rejects invalid clocks and repeated entity IDs without extra effects", async () => {
    const { prepared, s, local, append } = await fixture();
    try {
      const start = await append(opening(prepared));
      expect(
        await synchronizeOfflineAction({
          ...start,
          occurredAt: "2000-01-01T00:00:00.000Z",
        }),
      ).toMatchObject({ ok: false, code: "CONFLICT" });
      await synchronizeOfflineAction(start);
      const sold = await append(sale(prepared));
      await synchronizeOfflineAction(sold);
      expect(
        await synchronizeOfflineAction({ ...sold, id: uuid(), sequence: 3 }),
      ).toMatchObject({ ok: false, code: "CONFLICT" });
      expect(
        await db
          .select()
          .from(tables.sales)
          .where(eq(tables.sales.shiftId, s.shiftId)),
      ).toHaveLength(1);
    } finally {
      await local.delete();
    }
  });

  it("prepares every location regardless of absent or old pilot settings and reserves one installation", async () => {
    const { prepared, s, local } = await fixture();
    try {
      await db
        .delete(tables.offlineShiftSessions)
        .where(eq(tables.offlineShiftSessions.id, prepared.id));
      await db
        .update(tables.offlinePilots)
        .set({ enabled: false })
        .where(eq(tables.offlinePilots.businessId, s.businessId));
      const first = await prepareOfflineShift(s.shiftId);
      const otherLocationId = uuid();
      await db.insert(tables.sellingLocations).values({
        id: otherLocationId,
        businessId: s.businessId,
        name: "Second location",
      });
      for (const hasOldPilot of [true, false]) {
        if (hasOldPilot)
          await db
            .update(tables.offlinePilots)
            .set({ enabled: true })
            .where(eq(tables.offlinePilots.businessId, s.businessId));
        else
          await db
            .delete(tables.offlinePilots)
            .where(eq(tables.offlinePilots.businessId, s.businessId));
        const shiftId = uuid();
        await db.insert(tables.shifts).values({
          id: shiftId,
          businessId: s.businessId,
          sellingLocationId: otherLocationId,
          shiftDate: s.shiftDate,
        });
        await db.insert(tables.shiftAssignments).values({
          id: uuid(),
          businessId: s.businessId,
          shiftId,
          employeeId: s.employeeId,
        });
        expect((await prepareOfflineShift(shiftId)).snapshot.locationName).toBe(
          "Second location",
        );
      }
      expect(first.snapshot.products[0]?.priceCents).toBe(10000);
      expect(first.snapshot.recipes).toHaveLength(1);
      expect((await prepareOfflineShift(s.shiftId)).id).toBe(first.id);
      const originalStorage = context.storageId;
      context.storageId = uuid();
      await expect(prepareOfflineShift(s.shiftId)).rejects.toThrow(
        "Another device",
      );
      context.storageId = originalStorage;
      context.device = "another-cookie";
      await expect(prepareOfflineShift(s.shiftId)).rejects.toThrow(
        "Another device",
      );
    } finally {
      await local.delete();
    }
  });
  it("requires prepared new starts but accepts a retry of a historical opening", async () => {
    const { prepared, local, append } = await fixture();
    try {
      const operation = opening(prepared);
      await synchronizeOfflineAction(await append(operation));
      await db
        .update(tables.offlineShiftSessions)
        .set({ status: "closed" })
        .where(eq(tables.offlineShiftSessions.id, prepared.id));
      if (operation.type !== "START_SHIFT") throw new Error();
      expect((await startAssignedShift(operation.payload)).idempotent).toBe(
        true,
      );
      await expect(
        startAssignedShift({ ...operation.payload, openingEventId: uuid() }),
      ).rejects.toThrow("Open Start shift");
    } finally {
      await local.delete();
    }
  });
  it("shows acknowledged device activity and preserves the journal through freeze and restore", async () => {
    const { prepared, local, append } = await fixture();
    try {
      let devices = await getOfflineAdministration();
      expect(devices.find((row) => row.id === prepared.id)).toMatchObject({
        acknowledgedSequence: 0,
        lastAcknowledgedAt: null,
      });
      await synchronizeOfflineAction(await append(opening(prepared)));
      devices = await getOfflineAdministration();
      expect(
        devices.find((row) => row.id === prepared.id)?.lastAcknowledgedAt,
      ).toBeTruthy();
      await recoverOfflineDevice(
        prepared.id,
        "freeze",
        "Original device is missing.",
      );
      expect((await getOfflineAdministration())[0]?.status).toBe("recovery");
      expect(await offlineRecoveryJournal(prepared.id)).toHaveLength(1);
      await recoverOfflineDevice(
        prepared.id,
        "restore",
        "Original device recovered and receipts checked.",
      );
      expect(
        (await getOfflineAdministration()).find((row) => row.id === prepared.id)
          ?.status,
      ).toBe("active");
      expect(await offlineRecoveryJournal(prepared.id)).toHaveLength(1);
      await expect(offlineRecoveryJournal(uuid())).rejects.toThrow("not found");
      const originalAccess = context.access;
      try {
        context.access = { ...originalAccess, business: { id: uuid() } };
        expect(await getOfflineAdministration()).toEqual([]);
        await expect(offlineRecoveryJournal(prepared.id)).rejects.toThrow(
          "not found",
        );
        await expect(
          recoverOfflineDevice(prepared.id, "freeze", "Wrong business fixture"),
        ).rejects.toThrow("not found");
      } finally {
        context.access = originalAccess;
      }
    } finally {
      await local.delete();
    }
  });
  it("rolls back business effects if the synchronization receipt cannot commit", async () => {
    const { prepared, s, local, append } = await fixture();
    try {
      await synchronizeOfflineAction(await append(opening(prepared)));
      const sold = await append(sale(prepared));
      const original = context.db;
      context.db = {
        ...original,
        transaction: (work: Parameters<Database["transaction"]>[0]) =>
          db.transaction(async (tx) => {
            const insert = tx.insert.bind(tx);
            tx.insert = ((table: Parameters<typeof tx.insert>[0]) => {
              if (table === tables.offlineSyncActions)
                throw new Error("Receipt commit interrupted");
              return insert(table);
            }) as typeof tx.insert;
            return work(
              tx as unknown as Parameters<
                Parameters<Database["transaction"]>[0]
              >[0],
            );
          }),
      } as Database;
      try {
        await expect(synchronizeOfflineAction(sold)).rejects.toThrow(
          "Receipt commit interrupted",
        );
      } finally {
        context.db = original;
      }
      expect(
        await db
          .select()
          .from(tables.sales)
          .where(eq(tables.sales.shiftId, s.shiftId)),
      ).toHaveLength(0);
      expect(await synchronizeOfflineAction(sold)).toMatchObject({ ok: true });
      expect(
        await db
          .select()
          .from(tables.sales)
          .where(eq(tables.sales.shiftId, s.shiftId)),
      ).toHaveLength(1);
    } finally {
      await local.delete();
    }
  });
  it("denies direct browser access to prepared snapshots and journal writes", async () => {
    await pg.exec("set role authenticated");
    try {
      await expect(
        pg.query("select * from public.offline_shift_sessions"),
      ).rejects.toThrow("permission denied");
      await expect(
        pg.query("delete from public.offline_sync_actions"),
      ).rejects.toThrow("permission denied");
    } finally {
      await pg.exec("reset role");
    }
  });

  it("accepts mixed-case proof payment associations without rewriting the journal", async () => {
    const { prepared, local, append } = await fixture();
    try {
      await synchronizeOfflineAction(await append(opening(prepared)));
      const sold = await append(sale(prepared));
      if (sold.operation.type !== "CREATE_SALE") throw new Error();
      const payment = sold.operation.payload.payments[0]!;
      payment.id = `a${payment.id.slice(1)}`;
      payment.paymentMethod = "gcash";
      payment.amountCents = 20000;
      payment.referenceNumber = "MIXED-CASE";
      const fileId = uuid();
      const file = new File(["%PDF-mixed-case"], "proof.pdf", {
        type: "application/pdf",
      });
      sold.operation.proofs = [
        {
          fileId,
          paymentId: payment.id.toUpperCase(),
          name: file.name,
          mimeType: "application/pdf",
          size: file.size,
        },
      ];
      expect(await synchronizeOfflineAction(sold)).toMatchObject({ ok: true });
      const [saved] = await db
        .select({ payload: tables.offlineSyncActions.payload })
        .from(tables.offlineSyncActions)
        .where(eq(tables.offlineSyncActions.clientActionId, sold.id));
      expect(saved?.payload).toEqual(sold);
      const changed = structuredClone(sold);
      if (changed.operation.type !== "CREATE_SALE") throw new Error();
      changed.operation.proofs[0]!.paymentId = payment.id;
      expect(await synchronizeOfflineAction(changed)).toMatchObject({
        ok: false,
        code: "CONFLICT",
      });
      expect(
        await attachPaymentProof({ fileId, paymentId: payment.id, file }),
      ).toMatchObject({ fileId });
      expect(
        await synchronizeOfflineAction(await append(closeout(prepared, 0))),
      ).toMatchObject({ ok: true, sessionStatus: "closed" });
    } finally {
      await local.delete();
    }
  });

  it.each(["file", "payment"])(
    "rejects case-alias proof %s IDs before writing a sale",
    async (alias) => {
      const { prepared, s, local, append } = await fixture();
      try {
        await synchronizeOfflineAction(await append(opening(prepared)));
        const sold = await append(sale(prepared));
        if (sold.operation.type !== "CREATE_SALE") throw new Error();
        sold.operation.payload.payments = [
          {
            id: `a${uuid().slice(1)}`,
            paymentMethod: "gcash",
            amountCents: 10000,
            referenceNumber: "FIRST",
          },
          {
            id: uuid(),
            paymentMethod: "bank_transfer",
            amountCents: 10000,
            referenceNumber: "SECOND",
          },
        ];
        const fileId = `a${uuid().slice(1)}`;
        const firstPaymentId = sold.operation.payload.payments[0]!.id;
        sold.operation.proofs = sold.operation.payload.payments.map(
          (payment, index) => ({
            fileId:
              alias === "file"
                ? index
                  ? fileId.toUpperCase()
                  : fileId
                : uuid(),
            paymentId:
              alias === "payment"
                ? index
                  ? firstPaymentId.toUpperCase()
                  : payment.id
                : payment.id,
            name: "proof.pdf",
            size: 20,
            mimeType: "application/pdf" as const,
          }),
        );
        await expect(synchronizeOfflineAction(sold)).rejects.toThrow(/unique/);
        expect(
          await db
            .select()
            .from(tables.sales)
            .where(eq(tables.sales.shiftId, s.shiftId)),
        ).toHaveLength(0);
        expect(
          await db
            .select()
            .from(tables.payments)
            .where(eq(tables.payments.businessId, s.businessId)),
        ).toHaveLength(0);
        const [session] = await db
          .select()
          .from(tables.offlineShiftSessions)
          .where(eq(tables.offlineShiftSessions.id, prepared.id));
        expect(session?.acknowledgedSequence).toBe(1);
      } finally {
        await local.delete();
      }
    },
  );

  it("recovers a lost proof-upload acknowledgement and repeats safely after closure", async () => {
    const { prepared, local, append } = await fixture();
    try {
      await synchronizeOfflineAction(await append(opening(prepared)));
      const sold = await append(sale(prepared));
      if (sold.operation.type !== "CREATE_SALE") throw new Error();
      const payment = sold.operation.payload.payments[0]!;
      payment.paymentMethod = "gcash";
      payment.amountCents = 20000;
      payment.referenceNumber = "GCASH-TEST";
      const fileId = uuid();
      const file = new File(["%PDF-test proof"], "proof.pdf", {
        type: "application/pdf",
      });
      sold.operation.proofs = [
        {
          fileId: fileId.toUpperCase(),
          paymentId: payment.id,
          name: file.name,
          mimeType: "application/pdf",
          size: file.size,
        },
      ];
      await synchronizeOfflineAction(sold);
      const closed = await append(closeout(prepared, 0));
      expect(await synchronizeOfflineAction(closed)).toMatchObject({
        ok: false,
        code: "PROOF_PENDING",
      });
      context.loseUploadAck = true;
      const uploadedBefore = context.objects.size;
      await expect(
        attachPaymentProof({ fileId: uuid(), paymentId: payment.id, file }),
      ).rejects.toThrow(/declared/i);
      expect(context.objects.size).toBe(uploadedBefore);
      expect(
        await attachPaymentProof({
          fileId: fileId.toUpperCase(),
          paymentId: payment.id.toUpperCase(),
          file,
        }),
      ).toMatchObject({ fileId });
      expect(await synchronizeOfflineAction(closed)).toMatchObject({
        ok: true,
        sessionStatus: "closed",
      });
      expect(
        await attachPaymentProof({ fileId, paymentId: payment.id, file }),
      ).toMatchObject({ idempotent: true });
    } finally {
      context.loseUploadAck = false;
      await local.delete();
    }
  });

  it.each(["recovery", "different content"])(
    "rechecks proof authorization after upload when %s wins the race",
    async (change) => {
      const { prepared, local, append } = await fixture();
      try {
        await synchronizeOfflineAction(await append(opening(prepared)));
        const sold = await append(sale(prepared));
        if (sold.operation.type !== "CREATE_SALE") throw new Error();
        const payment = sold.operation.payload.payments[0]!;
        payment.paymentMethod = "gcash";
        payment.amountCents = 20000;
        payment.referenceNumber = "PROOF-RACE";
        const fileId = uuid();
        const file = new File(["%PDF-original"], "proof.pdf", {
          type: "application/pdf",
        });
        sold.operation.proofs = [
          {
            fileId,
            paymentId: payment.id,
            name: file.name,
            size: file.size,
            mimeType: "application/pdf",
          },
        ];
        await synchronizeOfflineAction(sold);
        const upload = { paymentId: payment.id, fileId, file };
        const competing = new File(["%PDF-competing"], "proof.pdf", {
          type: "application/pdf",
        });
        context.afterUpload = async () => {
          if (change === "recovery") {
            await db
              .update(tables.offlineShiftSessions)
              .set({ status: "recovery" })
              .where(eq(tables.offlineShiftSessions.id, prepared.id));
          } else {
            await attachPaymentProof({ ...upload, file: competing });
          }
        };
        await expect(attachPaymentProof(upload)).rejects.toThrow(
          change === "recovery" ? /recovery/ : /different/,
        );
        const [storedPayment] = await db
          .select()
          .from(tables.payments)
          .where(eq(tables.payments.id, payment.id));
        if (change === "recovery") {
          expect(storedPayment?.proofFileId).toBeNull();
          await db
            .update(tables.offlineShiftSessions)
            .set({ status: "active" })
            .where(eq(tables.offlineShiftSessions.id, prepared.id));
          expect(await attachPaymentProof(upload)).toMatchObject({ fileId });
        } else {
          expect(storedPayment?.proofFileId).toBe(fileId);
          expect(
            await attachPaymentProof({ ...upload, file: competing }),
          ).toMatchObject({ idempotent: true });
        }
        expect(
          await synchronizeOfflineAction(await append(closeout(prepared, 0))),
        ).toMatchObject({ ok: true, sessionStatus: "closed" });
      } finally {
        context.afterUpload = null;
        await local.delete();
      }
    },
  );

  it.each(["online", "prepared"])(
    "continues to accept optional payment proofs for %s sales",
    async (mode) => {
      const { prepared, local, append } = await fixture();
      try {
        const started = opening(prepared);
        const sold = sale(prepared);
        if (started.type !== "START_SHIFT" || sold.type !== "CREATE_SALE")
          throw new Error();
        const payment = sold.payload.payments[0]!;
        payment.paymentMethod = "gcash";
        payment.amountCents = 20000;
        payment.referenceNumber = "OPTIONAL-PROOF";
        if (mode === "online") {
          await seedHistoricalActiveShift(prepared);
          await finalizeSale(sold.payload);
        } else {
          await synchronizeOfflineAction(await append(started));
          await synchronizeOfflineAction(await append(sold));
        }
        const upload = {
          paymentId: payment.id,
          fileId: uuid(),
          file: new File(["%PDF-optional"], "proof.pdf", {
            type: "application/pdf",
          }),
        };
        expect(await attachPaymentProof(upload)).toMatchObject({
          idempotent: false,
        });
        expect(await attachPaymentProof(upload)).toMatchObject({
          idempotent: true,
        });
      } finally {
        await local.delete();
      }
    },
  );

  it.each(["inactive", "deleted"])(
    "reconciles a queued adjustment after its prepared item becomes %s",
    async (status) => {
      const { prepared, s, local, append } = await fixture();
      try {
        const item = await createInventoryItem({
          name: "Prepared spare lids",
          sku: null,
          itemType: "packaging",
          unit: "pcs",
          defaultUnitCostCents: 50,
          trackStock: true,
          status: "active",
        });
        s.inventory.push({
          id: item.id,
          name: item.name,
          unit: item.unit,
          defaultUnitCostCents: item.defaultUnitCostCents,
        });
        await db
          .update(tables.offlineShiftSessions)
          .set({ snapshot: s })
          .where(eq(tables.offlineShiftSessions.id, prepared.id));
        await local.sessions.update(prepared.id, { snapshot: s });
        const started = opening(prepared);
        const closed = closeout(prepared, 0, 10);
        if (started.type !== "START_SHIFT" || closed.type !== "SUBMIT_CLOSEOUT")
          throw new Error();
        const counts = s.inventory.map(({ id }) => ({
          inventoryItemId: id,
          quantity: 10,
        }));
        started.payload.counts = counts;
        closed.payload.counts = counts;
        expect(
          await synchronizeOfflineAction(await append(started)),
        ).toMatchObject({ ok: true, sequence: 1 });
        const adjustmentId = uuid();
        const queued = await append({
          type: "CREATE_INVENTORY_ADJUSTMENT",
          payload: {
            adjustmentId,
            inventoryEventId: uuid(),
            shiftId: s.shiftId,
            inventoryItemId: item.id,
            quantityDelta: 1,
            reason: "Found a spare lid before reconnecting",
          },
        });
        if (status === "deleted") await softDeleteInventoryItem(item.id);
        else
          await updateInventoryItem(item.id, { ...item, status: "inactive" });
        expect(await synchronizeOfflineAction(queued)).toMatchObject({
          ok: true,
          sequence: 2,
          result: { status: "pending" },
        });
        const [session] = await db
          .select()
          .from(tables.offlineShiftSessions)
          .where(eq(tables.offlineShiftSessions.id, prepared.id));
        expect(session?.acknowledgedSequence).toBe(2);
        const [balance] = await db
          .select()
          .from(tables.inventoryBalances)
          .where(eq(tables.inventoryBalances.inventoryItemId, item.id));
        expect(Number(balance?.quantityOnHand)).toBe(10);
        await expect(
          reviewInventoryAdjustment({
            adjustmentId,
            inventoryEventId: uuid(),
            decision: "approved",
          }),
        ).rejects.toThrow(/linkage/);
        expect(
          await reviewInventoryAdjustment({
            adjustmentId,
            decision: "rejected",
          }),
        ).toMatchObject({ status: "rejected" });
        expect(
          await synchronizeOfflineAction(await append(closed)),
        ).toMatchObject({ ok: true, sequence: 3, sessionStatus: "closed" });
      } finally {
        await local.delete();
      }
    },
  );

  it.each(["inactive", "deleted"])(
    "can reject an adjustment for an %s item and then close the shift",
    async (status) => {
      const { prepared, s, local } = await fixture();
      try {
        s.features.approvalsEnabled = true;
        const sold = sale(prepared);
        const closed = closeout(prepared);
        if (sold.type !== "CREATE_SALE" || closed.type !== "SUBMIT_CLOSEOUT")
          throw new Error();
        await seedHistoricalActiveShift(prepared);
        await finalizeSale(sold.payload);
        const item = await createInventoryItem({
          name: "Spare lids",
          sku: null,
          itemType: "packaging",
          unit: "pcs",
          defaultUnitCostCents: 50,
          trackStock: true,
          status: "active",
        });
        const adjustmentId = uuid();
        await submitInventoryAdjustment({
          adjustmentId,
          inventoryEventId: uuid(),
          shiftId: s.shiftId,
          inventoryItemId: item.id,
          quantityDelta: 1,
          reason: "Found a spare lid",
        });
        if (status === "deleted") await softDeleteInventoryItem(item.id);
        else
          await updateInventoryItem(item.id, { ...item, status: "inactive" });
        await expect(
          submitInventoryAdjustment({
            adjustmentId: uuid(),
            inventoryEventId: uuid(),
            shiftId: s.shiftId,
            inventoryItemId: item.id,
            quantityDelta: 1,
            reason: "A new online request for an unavailable item",
          }),
        ).rejects.toThrow(/Inventory item not found/);
        await expect(
          reviewInventoryAdjustment({
            adjustmentId,
            inventoryEventId: uuid(),
            decision: "approved",
          }),
        ).rejects.toThrow(/linkage/);
        await expect(submitShiftCloseout(closed.payload)).rejects.toThrow(
          /review/,
        );
        expect(
          await reviewInventoryAdjustment({
            adjustmentId,
            decision: "rejected",
          }),
        ).toMatchObject({ status: "rejected" });
        expect(await submitShiftCloseout(closed.payload)).toMatchObject({
          expectedCashCents: 20000,
          cashDifferenceCents: 0,
        });
      } finally {
        await local.delete();
      }
    },
  );
});

describe("photo-required promos", () => {
  it("creates and edits a configurable photo-required promo", async () => {
    const { local } = await fixture();
    try {
      const promo = await createPromo({
        name: "PWD Discount",
        discountType: "fixed_amount",
        discountValue: 10,
        requiresPhoto: true,
        startsAt: null,
        endsAt: null,
      });
      expect(promo).toMatchObject({ discountValue: 10, requiresPhoto: true });
      const edited = await createPromo(
        {
          ...promo,
          discountValue: 15,
          requiresPhoto: false,
          startsAt: null,
          endsAt: null,
        },
        promo.id,
      );
      expect(edited).toMatchObject({
        id: promo.id,
        discountValue: 15,
        requiresPhoto: false,
      });
    } finally {
      await local.delete();
    }
  });
  it.each(["lowercase", "uppercase"])(
    "retains the required photo offline with %s UUIDs, retries safely, and blocks closeout until linked",
    async (casing) => {
      const { prepared, s, local, append } = await fixture();
      try {
        const promo = {
          id: uuid(),
          name: "Senior Discount",
          discountType: "fixed_amount" as const,
          discountValue: 10,
          requiresPhoto: true,
        };
        s.promos = [promo];
        await db
          .update(tables.offlineShiftSessions)
          .set({ snapshot: s })
          .where(eq(tables.offlineShiftSessions.id, prepared.id));
        await local.sessions.update(prepared.id, { snapshot: s });
        await synchronizeOfflineAction(await append(opening(prepared)));
        const op = sale(prepared);
        if (op.type !== "CREATE_SALE") throw new Error();
        const fileId = casing === "uppercase" ? uuid().toUpperCase() : uuid();
        const file = new File(
          [new Uint8Array([0xff, 0xd8, 0xff, 0x00])],
          "senior.jpg",
          { type: "image/jpeg" },
        );
        op.payload.items[0]!.discountCents = 1000;
        op.payload.discount = { promoId: promo.id, proofFileId: fileId };
        expect(() => offlineOperationSchema.parse(op)).toThrow(/photo/);
        op.discountProof = {
          fileId,
          name: file.name,
          mimeType: "image/jpeg",
          size: file.size,
        };
        const parsed = offlineOperationSchema.parse(op);
        await expect(
          appendShiftAction(prepared.id, parsed, uuid(), [], local),
        ).rejects.toThrow(/photo is missing/);
        const envelope = await appendShiftAction(
          prepared.id,
          parsed,
          uuid(),
          [
            {
              id: fileId,
              sessionId: prepared.id,
              saleId: op.payload.saleId,
              file,
              synced: 0,
            },
          ],
          local,
        );
        expect((await local.proofs.get(fileId))?.file.size).toBe(file.size);
        const request: OfflineEnvelope = {
          schemaVersion: envelope.schemaVersion,
          id: envelope.id,
          sessionId: envelope.sessionId,
          snapshotId: envelope.snapshotId,
          sequence: envelope.sequence,
          occurredAt: envelope.occurredAt,
          operation: envelope.operation,
        };
        expect(await synchronizeOfflineAction(request)).toMatchObject({
          ok: true,
          result: { totalCents: 19000 },
        });
        const closed = await append(closeout(prepared, 19000));
        expect(await synchronizeOfflineAction(closed)).toMatchObject({
          ok: false,
          code: "PROOF_PENDING",
        });
        const upload = { saleId: op.payload.saleId, fileId, file };
        await expect(
          attachDiscountProof({ ...upload, fileId: uuid() }),
        ).rejects.toThrow(/does not match/);
        await expect(
          attachDiscountProof({
            ...upload,
            file: new File(["bad"], "bad.jpg", { type: "image/jpeg" }),
          }),
        ).rejects.toThrow(/content/);
        context.loseUploadAck = true;
        expect(await attachDiscountProof(upload)).toMatchObject({
          idempotent: false,
        });
        context.loseUploadAck = false;
        expect(await attachDiscountProof(upload)).toMatchObject({
          idempotent: true,
        });
        expect(
          await attachDiscountProof({
            ...upload,
            fileId: fileId.toLowerCase(),
          }),
        ).toMatchObject({
          idempotent: true,
        });
        await expect(
          attachDiscountProof({
            ...upload,
            file: new File(
              [new Uint8Array([0xff, 0xd8, 0xff, 0x01])],
              "different.jpg",
              { type: "image/jpeg" },
            ),
          }),
        ).rejects.toThrow(/different/);
        const [saved] = await db
          .select()
          .from(tables.sales)
          .where(eq(tables.sales.id, upload.saleId));
        expect(saved).toMatchObject({
          discountPromoName: "Senior Discount",
          discountProofFileId: fileId.toLowerCase(),
        });
        expect(await synchronizeOfflineAction(closed)).toMatchObject({
          ok: true,
        });
      } finally {
        context.loseUploadAck = false;
        await local.delete();
      }
    },
  );
});
