import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import * as tables from "@miniros/db/schema";
import type { Database } from "@miniros/db";
import type { requireActiveBusiness } from "./access";

const context = vi.hoisted(() => ({
  database: null as unknown as Database,
  access: null as unknown as Awaited<ReturnType<typeof requireActiveBusiness>>,
}));
vi.mock("@miniros/db", async (original) => ({
  ...(await original<typeof import("@miniros/db")>()),
  requireDatabase: () => context.database,
}));
vi.mock("./access", async () => {
  const { AccessError } = await import("./access-error");
  return {
    AccessError,
    requireActiveBusiness: async (
      options: { admin?: boolean; employeePermission?: string } = {},
    ) => {
      if (
        options.admin &&
        !["owner", "admin"].includes(context.access.membership.role)
      )
        throw new AccessError("Admin access required.");
      if (
        options.employeePermission === "pos" &&
        !context.access.employee?.canUsePos
      )
        throw new AccessError("POS access required.");
      return context.access;
    },
  };
});
import { getInventoryWorkspace } from "./inventory-workspace";
import {
  submitInventoryAdjustment,
  reviewInventoryAdjustment,
} from "./inventory-adjustment-operations";
import { submitCashDeduction } from "./cash-deduction-operations";
import {
  receiveStock,
  transferStock,
  listStockWorkspace,
} from "./stock-operations";
import { getCloseoutWorkspace } from "./closeout-workspace";
const pg = new PGlite();
const database = drizzle(pg, { schema: tables });
const uuid = randomUUID;
beforeAll(async () => {
  await pg.exec(
    "create schema auth; create table auth.users (id uuid primary key); create role anon; create role authenticated; create role service_role; create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;",
  );
  for (const migration of [
    "20260828212149_initial_public_schema",
    "20260902063702_catalog_safety_navigation",
    "20260902064344_powerful_the_captain",
    "20260902065424_standalone_production_finished_goods",
    "20260902080000_automatic_recipe_unit_cost",
    "20260905022136_shift_draft_statuses",
    "20260905040950_offline_shift_sessions",
  ]) {
    await pg.exec(
      readFileSync(
        resolve(process.cwd(), `../../supabase/migrations/${migration}.sql`),
        "utf8",
      ),
    );
  }
  context.database = database as unknown as Database;
}, 60000);
afterAll(async () => {
  await pg.close();
});
async function fixture(approvalsEnabled = false) {
  const ids = {
    business: uuid(),
    user: uuid(),
    member: uuid(),
    employee: uuid(),
    teammate: uuid(),
    shift: uuid(),
    location: uuid(),
    inventory: uuid(),
    central: uuid(),
    cup: uuid(),
    milk: uuid(),
  };
  await database.insert(tables.authUsers).values({ id: ids.user });
  await database.insert(tables.businesses).values({
    id: ids.business,
    name: "Inventory test",
    createdBy: ids.user,
    approvalsEnabled,
  });
  await database.insert(tables.businessMembers).values({
    id: ids.member,
    businessId: ids.business,
    authUserId: ids.user,
    role: "owner",
    status: "active",
  });
  await database.insert(tables.employees).values([
    {
      id: ids.employee,
      businessId: ids.business,
      memberId: ids.member,
      displayName: "Operator",
      canUsePos: true,
    },
    {
      id: ids.teammate,
      businessId: ids.business,
      displayName: "Teammate",
      canUsePos: true,
    },
  ]);
  await database.insert(tables.sellingLocations).values({
    id: ids.location,
    businessId: ids.business,
    name: "Market booth",
  });
  await database.insert(tables.shifts).values({
    id: ids.shift,
    businessId: ids.business,
    sellingLocationId: ids.location,
    shiftDate: "2026-09-05",
    status: "active",
    actualStartAt: new Date("2026-09-05T01:00:00Z"),
  });
  await database.insert(tables.shiftAssignments).values({
    id: uuid(),
    businessId: ids.business,
    shiftId: ids.shift,
    employeeId: ids.employee,
    salaryRateCents: 0,
  });
  await database.insert(tables.inventoryLocations).values([
    {
      id: ids.inventory,
      businessId: ids.business,
      shiftId: ids.shift,
      sellingLocationId: ids.location,
      locationType: "shift",
      name: "Booth stock",
    },
    {
      id: ids.central,
      businessId: ids.business,
      locationType: "central",
      name: "Storage",
    },
  ]);
  await database.insert(tables.inventoryItems).values([
    {
      id: ids.cup,
      businessId: ids.business,
      name: "Cup",
      sku: "CUP",
      itemType: "packaging",
      unit: "pcs",
    },
    {
      id: ids.milk,
      businessId: ids.business,
      name: "Milk",
      sku: "MILK",
      itemType: "raw_good",
      unit: "l",
    },
  ]);
  await database.insert(tables.inventoryBalances).values([
    {
      id: uuid(),
      businessId: ids.business,
      inventoryLocationId: ids.inventory,
      inventoryItemId: ids.cup,
      quantityOnHand: "10.000",
    },
  ]);
  await database.insert(tables.shiftInventoryCounts).values({
    id: uuid(),
    businessId: ids.business,
    shiftId: ids.shift,
    inventoryItemId: ids.cup,
    countType: "opening",
    countedQuantity: "10.000",
    unit: "pcs",
    countedBy: ids.employee,
  });
  context.access = {
    user: { id: ids.user },
    membership: { id: ids.member, role: "owner" },
    employee: { id: ids.employee, canUsePos: true, canLogProduction: false },
    business: {
      id: ids.business,
      name: "Inventory test",
      features: {
        approvalsEnabled,
        promosEnabled: false,
        productionEnabled: false,
        recipesEnabled: false,
      },
    },
  } as typeof context.access;
  return ids;
}
const balance = async (location: string, item: string) =>
  (
    await database
      .select()
      .from(tables.inventoryBalances)
      .where(
        and(
          eq(tables.inventoryBalances.inventoryLocationId, location),
          eq(tables.inventoryBalances.inventoryItemId, item),
        ),
      )
  )[0]?.quantityOnHand;

describe("inventory workspace and operational transactions", () => {
  it("scopes selection to the employee and business, includes zero-balance items, and preserves closeout reads", async () => {
    const a = await fixture();
    const workspace = await getInventoryWorkspace();
    expect(workspace.selected?.shift.id).toBe(a.shift);
    expect(workspace.selected?.canRecord).toBe(true);
    expect(
      workspace.selected?.items.find((item) => item.inventoryItemId === a.milk)
        ?.quantityOnHand,
    ).toBe("0.000");
    expect((await getCloseoutWorkspace(a.shift)).balances).toHaveLength(1);
    expect((await getInventoryWorkspace("not-a-uuid")).selected).toBeNull();
    const b = await fixture();
    expect((await getInventoryWorkspace(a.shift)).selected).toBeNull();
    await database
      .update(tables.shiftAssignments)
      .set({ status: "cancelled" })
      .where(eq(tables.shiftAssignments.shiftId, b.shift));
    expect((await getInventoryWorkspace(b.shift)).selected).toBeNull();
  });
  it("records a multi-item receipt and transfer atomically, includes null-shift events and item history", async () => {
    const f = await fixture();
    const receipt = {
      receivingId: uuid(),
      inventoryEventId: uuid(),
      inventoryLocationId: f.central,
      referenceNumber: "Delivery",
      notes: null,
      lines: [
        { inventoryItemId: f.cup, quantity: "6" },
        { inventoryItemId: f.milk, quantity: "2.500" },
      ],
    };
    await receiveStock(receipt);
    await receiveStock(receipt);
    expect(await balance(f.central, f.cup)).toBe("6.000");
    const transfer = {
      transferId: uuid(),
      transferOutEventId: uuid(),
      transferInEventId: uuid(),
      fromInventoryLocationId: f.central,
      toInventoryLocationId: f.inventory,
      notes: null,
      lines: [
        { inventoryItemId: f.cup, quantity: "3" },
        { inventoryItemId: f.milk, quantity: "1.250" },
      ],
    };
    await transferStock(transfer);
    await transferStock(transfer);
    expect(await balance(f.inventory, f.cup)).toBe("13.000");
    expect(await balance(f.inventory, f.milk)).toBe("1.250");
    expect(
      (await getInventoryWorkspace(f.shift)).selected?.recentEvents.filter(
        (event) => event.eventType === "transfer_in",
      ),
    ).toHaveLength(2);
    const recent = await listStockWorkspace();
    expect(recent.receivings[0]?.lines).toHaveLength(2);
    expect(recent.transfers[0]?.lines).toHaveLength(2);
    await expect(
      transferStock({
        ...transfer,
        transferId: uuid(),
        transferOutEventId: uuid(),
        transferInEventId: uuid(),
        lines: [
          { inventoryItemId: f.cup, quantity: "1" },
          { inventoryItemId: f.milk, quantity: "999" },
        ],
      }),
    ).rejects.toThrow("Insufficient inventory");
    expect(await balance(f.central, f.cup)).toBe("3.000");
    expect(await balance(f.inventory, f.cup)).toBe("13.000");
    expect((await listStockWorkspace()).transfers).toHaveLength(1);
    await expect(
      transferStock({ ...transfer, toInventoryLocationId: f.central }),
    ).rejects.toThrow("different");
    await expect(
      receiveStock({
        ...receipt,
        receivingId: uuid(),
        lines: [receipt.lines[0]!, receipt.lines[0]!],
      }),
    ).rejects.toThrow();
  });
  it("keeps historical closing counts unchanged after transfers and archived items/locations", async () => {
    const f = await fixture();
    const beforeClose = new Date(Date.now() - 2 * 3600000);
    const closedAt = new Date(Date.now() - 3600000);
    const eventId = uuid();
    await database.insert(tables.inventoryEvents).values({
      id: eventId,
      businessId: f.business,
      inventoryLocationId: f.inventory,
      eventType: "receiving",
      createdAt: beforeClose,
    });
    await database.insert(tables.inventoryEventLines).values({
      id: uuid(),
      eventId,
      businessId: f.business,
      inventoryItemId: f.cup,
      quantityDelta: "1",
      unit: "pcs",
    });
    await database.insert(tables.shiftInventoryCounts).values({
      id: uuid(),
      businessId: f.business,
      shiftId: f.shift,
      inventoryItemId: f.cup,
      countType: "closing",
      countedQuantity: "7.000",
      unit: "pcs",
      countedBy: f.employee,
      countedAt: closedAt,
    });
    await database
      .update(tables.shifts)
      .set({ status: "closed", actualEndAt: closedAt })
      .where(eq(tables.shifts.id, f.shift));
    await database
      .update(tables.shiftAssignments)
      .set({ status: "completed" })
      .where(eq(tables.shiftAssignments.shiftId, f.shift));
    await transferStock({
      transferId: uuid(),
      transferOutEventId: uuid(),
      transferInEventId: uuid(),
      fromInventoryLocationId: f.inventory,
      toInventoryLocationId: f.central,
      notes: null,
      lines: [{ inventoryItemId: f.cup, quantity: "2" }],
    });
    await database
      .update(tables.inventoryItems)
      .set({ status: "inactive" })
      .where(eq(tables.inventoryItems.id, f.cup));
    await database
      .update(tables.sellingLocations)
      .set({ status: "inactive" })
      .where(eq(tables.sellingLocations.id, f.location));
    const workspace = (await getInventoryWorkspace(f.shift)).selected!;
    expect(workspace.canRecord).toBe(false);
    expect(workspace.stock[0]).toMatchObject({
      name: "Cup",
      quantityOnHand: "7.000",
      openingQuantity: "10.000",
    });
    expect(workspace.recentEvents).toHaveLength(1);
    expect(workspace.recentEvents[0]?.eventType).toBe("receiving");
    await database
      .delete(tables.shiftInventoryCounts)
      .where(
        and(
          eq(tables.shiftInventoryCounts.shiftId, f.shift),
          eq(tables.shiftInventoryCounts.countType, "closing"),
        ),
      );
    expect(
      (await getInventoryWorkspace(f.shift)).selected?.stock[0]?.quantityOnHand,
    ).toBeNull();
    await expect(
      submitCashDeduction({
        deductionId: uuid(),
        shiftId: f.shift,
        label: "Ice",
        amountCents: 100,
      }),
    ).rejects.toThrow("open shift");
    await expect(
      submitInventoryAdjustment({
        adjustmentId: uuid(),
        inventoryEventId: uuid(),
        shiftId: f.shift,
        inventoryItemId: f.cup,
        quantityDelta: "1",
        reason: "Count correction",
      }),
    ).rejects.toThrow("open shift");
  });
  it("preserves approval status, request visibility and idempotent retries", async () => {
    const f = await fixture(true);
    const adjustment = {
      adjustmentId: uuid(),
      inventoryEventId: uuid(),
      shiftId: f.shift,
      inventoryItemId: f.cup,
      quantityDelta: "-2",
      reason: "Damaged",
    };
    expect(await submitInventoryAdjustment(adjustment)).toMatchObject({
      status: "pending",
    });
    await submitInventoryAdjustment(adjustment);
    expect(await balance(f.inventory, f.cup)).toBe("10.000");
    const cash = {
      deductionId: uuid(),
      shiftId: f.shift,
      label: "Ice",
      amountCents: 10000,
    };
    expect(await submitCashDeduction(cash)).toMatchObject({
      status: "pending",
    });
    await submitCashDeduction(cash);
    await database.insert(tables.cashDeductions).values({
      id: uuid(),
      businessId: f.business,
      shiftId: f.shift,
      requestedBy: f.teammate,
      label: "Teammate expense",
      amountCents: 200,
    });
    await database.insert(tables.inventoryAdjustments).values({
      id: uuid(),
      businessId: f.business,
      shiftId: f.shift,
      inventoryLocationId: f.inventory,
      inventoryItemId: f.cup,
      requestedBy: f.teammate,
      quantityDelta: "1",
      reason: "Teammate request",
    });
    expect(
      (await getInventoryWorkspace(f.shift)).selected?.cashDeductions,
    ).toHaveLength(2);
    context.access.membership.role = "employee";
    const employeeView = (await getInventoryWorkspace(f.shift)).selected!;
    expect(employeeView.cashDeductions).toHaveLength(1);
    expect(employeeView.adjustments).toHaveLength(1);
    await expect(
      receiveStock({
        receivingId: uuid(),
        inventoryEventId: uuid(),
        inventoryLocationId: f.central,
        referenceNumber: null,
        notes: null,
        lines: [{ inventoryItemId: f.cup, quantity: "1" }],
      }),
    ).rejects.toThrow("Admin access");
    context.access.membership.role = "owner";
    await reviewInventoryAdjustment({
      adjustmentId: adjustment.adjustmentId,
      inventoryEventId: uuid(),
      decision: "approved",
    });
    expect(await balance(f.inventory, f.cup)).toBe("8.000");
    expect(
      (await getInventoryWorkspace(f.shift)).selected?.adjustments.find(
        (item) => item.id === adjustment.adjustmentId,
      )?.status,
    ).toBe("applied");
  });
  it("applies immediate requests once, rejects insufficient stock and stale assignments", async () => {
    const f = await fixture();
    const adjustment = {
      adjustmentId: uuid(),
      inventoryEventId: uuid(),
      shiftId: f.shift,
      inventoryItemId: f.milk,
      quantityDelta: "1.250",
      reason: "Count correction",
    };
    expect(await submitInventoryAdjustment(adjustment)).toMatchObject({
      status: "applied",
    });
    await submitInventoryAdjustment(adjustment);
    expect(await balance(f.inventory, f.milk)).toBe("1.250");
    await expect(
      submitInventoryAdjustment({
        ...adjustment,
        adjustmentId: uuid(),
        inventoryEventId: uuid(),
        quantityDelta: "-9",
      }),
    ).rejects.toThrow("Insufficient inventory");
    const cash = {
      deductionId: uuid(),
      shiftId: f.shift,
      label: "Ice",
      amountCents: 100,
    };
    expect(await submitCashDeduction(cash)).toMatchObject({
      status: "approved",
    });
    await submitCashDeduction(cash);
    expect(
      (await getInventoryWorkspace(f.shift)).selected?.cashDeductions,
    ).toHaveLength(1);
    await database
      .update(tables.shiftAssignments)
      .set({ status: "cancelled" })
      .where(eq(tables.shiftAssignments.shiftId, f.shift));
    await expect(
      submitCashDeduction({ ...cash, deductionId: uuid() }),
    ).rejects.toThrow();
  });
});
