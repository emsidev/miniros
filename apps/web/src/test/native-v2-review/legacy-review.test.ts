import { randomUUID } from "node:crypto";
import { createPostgresClient } from "@miniros/db";
import { createV2Snapshot } from "@miniros/domain/v2";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prepareOfflineShift } from "../../server/services/offline-prepare";
import { synchronizeOfflineAction } from "../../server/services/offline-sync";
import { db, fixture, hash, url } from "./fixture";

const context = vi.hoisted(() => ({
  access: null as unknown,
  database: null as unknown,
  storageId: "22222222-2222-4222-8222-222222222222",
  cookie: "review-cookie",
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) => ({
        data: { user: { id: token } },
        error: null,
      }),
    },
  }),
}));
vi.mock("@miniros/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miniros/db")>();
  return { ...actual, requireDatabase: () => context.database };
});
vi.mock("../../server/services/access", async () => ({
  ...(await import("../../server/services/access-error")),
  requireActiveBusiness: async () => context.access,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: context.cookie }),
    set: () => {},
  }),
  headers: async () => new Headers({ "x-miniros-storage": context.storageId }),
}));
beforeAll(() => {
  context.database = db;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic-review.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-review-key");
  vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "1");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await createPostgresClient(url).end();
});

async function bothProtocols() {
  const h = await fixture(),
    shiftId = randomUUID(),
    categoryId = randomUUID();
  await db.execute(
    sql`INSERT INTO shifts(id,business_id,selling_location_id,shift_date) SELECT ${shiftId},business_id,selling_location_id,shift_date FROM shifts WHERE id=${h.shiftId}`,
  );
  await db.execute(
    sql`INSERT INTO shift_assignments(id,business_id,shift_id,employee_id,role_on_shift) VALUES(${randomUUID()},${h.businessId},${shiftId},${h.cashierEmployeeId},'operator')`,
  );
  await db.execute(
    sql`INSERT INTO product_categories(id,business_id,name) VALUES(${categoryId},${h.businessId},'Review')`,
  );
  await db.execute(
    sql`INSERT INTO products(id,business_id,category_id,name,sku,price_cents) VALUES(${randomUUID()},${h.businessId},${categoryId},'Legacy tea','review-tea',500)`,
  );
  await db.execute(
    sql`INSERT INTO inventory_items(id,business_id,name,sku,item_type,unit) VALUES(${randomUUID()},${h.businessId},'Legacy cup','review-cup','packaging','pcs')`,
  );
  context.access = {
    business: {
      id: h.businessId,
      name: "Review",
      features: {
        recipesEnabled: false,
        promosEnabled: false,
        approvalsEnabled: false,
      },
    },
    user: { id: h.cashierId },
    employee: { id: h.cashierEmployeeId },
  };
  const body = { ...h.snapshot };
  Reflect.deleteProperty(body, "hash");
  const snapshot = await createV2Snapshot(
    { ...body, id: randomUUID(), shiftId },
    hash,
  );
  return { ...h, shiftId, snapshot };
}

async function waitForLock(pid: () => number | undefined) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const current = pid();
    if (current) {
      const [row] = await db.execute(
        sql`SELECT wait_event_type FROM pg_stat_activity WHERE pid=${current}`,
      );
      if (row?.wait_event_type === "Lock") return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    "Independent PostgreSQL waiter never reached an actual lock wait",
  );
}

describe("EP05 independent legacy/native protocol exclusion on real PostgreSQL", () => {
  it("disabled rollout rejects new authorities while existing snapshot and original receipts remain usable", async () => {
    const h = await bothProtocols();
    const original = await h.service.ingest(h.cashier, h.opening);
    vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "0");
    try {
      await expect(
        h.service.registerSnapshot(h.owner, {
          snapshot: h.snapshot,
          cashierInstallationId: h.cashierInstallationId,
        }),
      ).rejects.toThrow("New native shifts are not enabled");
      expect(await h.service.ingest(h.cashier, h.opening)).toEqual(original);
      expect((await h.service.ingest(h.cashier, h.sale)).ok).toBe(true);
      expect(
        await db.execute(
          sql`SELECT id FROM v2_authorities WHERE shift_id=${h.shiftId}`,
        ),
      ).toHaveLength(0);
    } finally {
      vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "1");
    }
  });

  it("EP05-T06 replays supported v1 operations with frozen prices and historic fraction rounding after additive migration", async () => {
    const h = await bothProtocols(),
      legacy = await prepareOfflineShift(h.shiftId);
    const base = {
      schemaVersion: 1,
      sessionId: legacy.id,
      snapshotId: legacy.snapshot.id,
      occurredAt: new Date().toISOString(),
    };
    const opening = {
      ...base,
      id: randomUUID(),
      sequence: 1,
      operation: {
        type: "START_SHIFT",
        payload: {
          shiftId: h.shiftId,
          inventoryLocationId: legacy.snapshot.inventoryLocationId,
          openingEventId: randomUUID(),
          counts: [
            { inventoryItemId: legacy.snapshot.inventory[0]!.id, quantity: 10 },
          ],
        },
      },
    };
    expect(await synchronizeOfflineAction(opening)).toMatchObject({
      ok: true,
      sequence: 1,
    });
    await db.execute(
      sql`UPDATE products SET price_cents=900 WHERE business_id=${h.businessId}`,
    );
    const saleId = randomUUID();
    const sale = {
      ...base,
      id: randomUUID(),
      sequence: 2,
      operation: {
        type: "CREATE_SALE",
        payload: {
          shiftId: h.shiftId,
          saleId,
          inventoryEventId: randomUUID(),
          items: [
            {
              id: randomUUID(),
              productId: legacy.snapshot.products[0]!.id,
              quantity: 1.2346,
              discountCents: 0,
            },
          ],
          payments: [
            { id: randomUUID(), paymentMethod: "cash", amountCents: 1000 },
          ],
        },
        proofs: [],
      },
    };
    const original = await synchronizeOfflineAction(sale);
    expect(original).toMatchObject({ ok: true, sequence: 2 });
    expect(await synchronizeOfflineAction(sale)).toEqual(original);
    const [line] = await db.execute(
      sql`SELECT quantity,unit_price_cents,line_total_cents FROM sale_items WHERE sale_id=${saleId}`,
    );
    expect(line).toEqual({
      quantity: "1.235",
      unit_price_cents: "500",
      line_total_cents: "618",
    });
    expect(
      await db.execute(sql`SELECT id FROM sales WHERE id=${saleId}`),
    ).toHaveLength(1);
    expect(
      await db.execute(
        sql`SELECT id FROM v2_operations WHERE shift_id=${h.shiftId}`,
      ),
    ).toHaveLength(0);
  });

  it("legacy preparation still produces v1 snapshots and prevents a subsequent native claim", async () => {
    const h = await bothProtocols();
    const legacy = await prepareOfflineShift(h.shiftId);
    expect(legacy.snapshot.schemaVersion).toBe(1);
    expect(legacy.snapshot.products[0]!.priceCents).toBe(500);
    expect(await prepareOfflineShift(h.shiftId)).toEqual(legacy);
    await expect(
      h.service.registerSnapshot(h.owner, {
        snapshot: h.snapshot,
        cashierInstallationId: h.cashierInstallationId,
      }),
    ).rejects.toThrow("Reconcile the existing prepared device");
    expect(
      await db.execute(
        sql`SELECT id FROM v2_authorities WHERE shift_id=${h.shiftId}`,
      ),
    ).toHaveLength(0);
  });

  it("a native authority prevents a subsequent legacy preparation", async () => {
    const h = await bothProtocols();
    await h.service.registerSnapshot(h.owner, {
      snapshot: h.snapshot,
      cashierInstallationId: h.cashierInstallationId,
    });
    await expect(prepareOfflineShift(h.shiftId)).rejects.toThrow(
      "native v2 journal",
    );
    expect(
      await db.execute(
        sql`SELECT id FROM offline_shift_sessions WHERE shift_id=${h.shiftId}`,
      ),
    ).toHaveLength(0);
  });

  it("a legacy preparation already waiting on the native shift lock cannot claim a stale repeatable-read snapshot", async () => {
    const h = await bothProtocols(),
      transaction = db.transaction.bind(db);
    let unlock!: () => void, reached!: () => void;
    const hold = new Promise<void>((resolve) => {
        unlock = resolve;
      }),
      locked = new Promise<void>((resolve) => {
        reached = resolve;
      });
    const pids: number[] = [];
    const spy = vi.spyOn(db, "transaction").mockImplementation((work, config) =>
      transaction(async (tx) => {
        const result = await tx.execute(sql`SELECT pg_backend_pid() AS pid`);
        pids.push(Number(result[0]!.pid));
        const value = await work(tx);
        if (!config) {
          reached();
          await hold;
        }
        return value;
      }, config),
    );
    try {
      const native = h.service.registerSnapshot(h.owner, {
        snapshot: h.snapshot,
        cashierInstallationId: h.cashierInstallationId,
      });
      await locked;
      const legacy = prepareOfflineShift(h.shiftId);
      await waitForLock(() => pids[1]);
      unlock();
      const result = await Promise.allSettled([native, legacy]);
      expect(new Set(pids).size).toBe(2);
      expect(result[0]?.status).toBe("fulfilled");
      expect(result[1]?.status).toBe("rejected");
      if (result[1]?.status === "rejected")
        expect(result[1].reason.cause?.code ?? result[1].reason.code).toBe(
          "40001",
        );
      expect(
        await db.execute(
          sql`SELECT id FROM offline_shift_sessions WHERE shift_id=${h.shiftId}`,
        ),
      ).toHaveLength(0);
      await expect(prepareOfflineShift(h.shiftId)).rejects.toThrow(
        "native v2 journal",
      );
    } finally {
      unlock();
      spy.mockRestore();
    }
  });

  it("a native claim already waiting on legacy preparation sees that reservation after the lock releases", async () => {
    const h = await bothProtocols(),
      transaction = db.transaction.bind(db);
    let unlock!: () => void, reached!: () => void;
    const hold = new Promise<void>((resolve) => {
        unlock = resolve;
      }),
      locked = new Promise<void>((resolve) => {
        reached = resolve;
      });
    const pids: number[] = [];
    const spy = vi.spyOn(db, "transaction").mockImplementation((work, config) =>
      transaction(async (tx) => {
        const result = await tx.execute(sql`SELECT pg_backend_pid() AS pid`);
        pids.push(Number(result[0]!.pid));
        const value = await work(tx);
        if (config?.isolationLevel === "repeatable read") {
          reached();
          await hold;
        }
        return value;
      }, config),
    );
    try {
      const legacy = prepareOfflineShift(h.shiftId);
      await locked;
      const native = h.service.registerSnapshot(h.owner, {
        snapshot: h.snapshot,
        cashierInstallationId: h.cashierInstallationId,
      });
      await waitForLock(() => pids[1]);
      unlock();
      const result = await Promise.allSettled([legacy, native]);
      expect(new Set(pids).size).toBe(2);
      expect(result[0]?.status).toBe("fulfilled");
      expect(result[1]?.status).toBe("rejected");
      if (result[1]?.status === "rejected")
        expect(result[1].reason.code).toBe("LEGACY_RESERVED");
      expect(
        await db.execute(
          sql`SELECT id FROM v2_authorities WHERE shift_id=${h.shiftId}`,
        ),
      ).toHaveLength(0);
      expect(
        await db.execute(
          sql`SELECT id FROM offline_shift_sessions WHERE shift_id=${h.shiftId}`,
        ),
      ).toHaveLength(1);
    } finally {
      unlock();
      spy.mockRestore();
    }
  });
});
