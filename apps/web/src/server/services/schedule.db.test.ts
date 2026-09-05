import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import {
  createDatabase,
  createPostgresClient,
  type Database,
} from "@miniros/db";
import * as tables from "@miniros/db/schema";
import type { ShiftTransaction } from "./admin-shift-persistence";
import { manilaToday } from "@/lib/shift-planning";

const context = vi.hoisted(() => ({
  database: null as unknown as Database,
  businessId: "",
  userId: "",
}));
vi.mock("@miniros/db", async (original) => ({
  ...(await original<typeof import("@miniros/db")>()),
  requireDatabase: () => context.database,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: context.businessId }) }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: context.userId } },
        error: null,
      }),
    },
  }),
}));
import { joinShiftInTransaction, joinShift } from "./shift-join";
import { listScheduleShifts } from "./schedule";
import { getAssignedShift } from "./operator";
import {
  bulkShiftsInTransaction,
  updateShiftInTransaction,
} from "./admin-shift-workflows";
const connection = process.env.SHIFT_TEST_DATABASE_URL;
const pg = connection ? null : new PGlite();
const database: Database = connection
  ? createDatabase(connection)
  : (drizzle(pg!, { schema: tables }) as unknown as Database);
const {
  authUsers,
  businesses,
  businessMembers,
  employees,
  sellingLocations,
  shifts,
  shiftAssignments,
  shiftCosts,
  auditLogs,
  offlineShiftSessions,
} = tables;
beforeAll(async () => {
  if (connection) {
    context.database = database;
    return;
  }
  await pg!.exec(
    "create schema auth; create table auth.users (id uuid primary key); create role anon; create role authenticated; create role service_role; create function auth.uid() returns uuid language sql stable as $$ select (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')::uuid $$;",
  );
  for (const name of [
    "20260828212149_initial_public_schema",
    "20260828212202_row_level_security",
    "20260902063702_catalog_safety_navigation",
    "20260902064344_powerful_the_captain",
    "20260902065424_standalone_production_finished_goods",
    "20260902080000_automatic_recipe_unit_cost",
    "20260905022136_shift_draft_statuses",
    "20260905022223_shift_draft_privacy",
    "20260905040950_offline_shift_sessions",
    "20260905065933_centralized_schedule",
  ]) {
    await pg!.exec(
      readFileSync(
        resolve(process.cwd(), `../../supabase/migrations/${name}.sql`),
        "utf8",
      ),
    );
  }
  await pg!.exec(
    "grant usage on schema public, auth to authenticated; grant select, insert, update, delete on all tables in schema public to authenticated;",
  );
  context.database = database as unknown as Database;
}, 60000);
afterAll(async () => {
  if (connection) await createPostgresClient(connection).end();
  else await pg!.close();
});
async function fixture(tx: ShiftTransaction) {
  const businessId = randomUUID(),
    otherBusiness = randomUUID(),
    userId = randomUUID(),
    memberId = randomUUID(),
    employeeId = randomUUID(),
    locationId = randomUUID();
  await tx.insert(authUsers).values({ id: userId });
  await tx.insert(businesses).values([
    { id: businessId, name: "Schedule test", createdBy: userId },
    { id: otherBusiness, name: "Foreign business", createdBy: userId },
  ]);
  await tx.insert(businessMembers).values({
    id: memberId,
    businessId,
    authUserId: userId,
    role: "employee",
    status: "active",
  });
  await tx.insert(employees).values({
    id: employeeId,
    businessId,
    memberId,
    displayName: "Viewer",
    canUsePos: true,
    defaultShiftRateCents: 65000,
  });
  await tx
    .insert(sellingLocations)
    .values({ id: locationId, businessId, name: "Test market" });
  const actor = { businessId, userId, employeeId };
  context.businessId = businessId;
  context.userId = userId;
  context.database = tx as unknown as Database;
  const create = async (values: Partial<typeof shifts.$inferInsert> = {}) => {
    const id = randomUUID();
    await tx.insert(shifts).values({
      id,
      businessId,
      sellingLocationId: locationId,
      title: "Market shift",
      shiftDate: manilaToday(),
      ...values,
    });
    return id;
  };
  const assign = async (
    shiftId: string,
    status: typeof shiftAssignments.$inferInsert.status = "assigned",
  ) => {
    const id = randomUUID();
    await tx.insert(shiftAssignments).values({
      id,
      businessId,
      shiftId,
      employeeId,
      status,
      salaryRateCents: 1,
    });
    return id;
  };
  return { actor, create, assign, otherBusiness, locationId };
}
async function rollback(
  test: (
    tx: ShiftTransaction,
    f: Awaited<ReturnType<typeof fixture>>,
  ) => Promise<void>,
) {
  const sentinel = new Error("rollback fixture");
  try {
    await database.transaction(async (transaction) => {
      const tx = transaction as unknown as ShiftTransaction;
      await test(tx, await fixture(tx));
      throw sentinel;
    });
  } catch (error) {
    if (error !== sentinel) throw error;
  }
}

describe("central schedule database", () => {
  it("lists every published lifecycle, excludes drafts/cancelled/deleted/foreign rows, and protects operational details", () =>
    rollback(async (tx, f) => {
      const visible = [];
      for (const status of [
        "scheduled",
        "active",
        "closing",
        "closed",
      ] as const)
        visible.push(await f.create({ status }));
      const draft = await f.create({ status: "draft" });
      await f.assign(draft, "draft");
      await f.create({ status: "cancelled" });
      await f.create({ deletedAt: new Date() });
      await f.create({ businessId: f.otherBusiness });
      await f.assign(visible[0]!);
      const rows = await listScheduleShifts();
      expect(rows.map((row) => row.id).sort()).toEqual(visible.sort());
      expect(rows.filter((row) => row.assigned)).toHaveLength(1);
      expect(
        rows.every(
          (row) =>
            !("salaryRateCents" in row) &&
            !("notes" in row) &&
            !("profitCents" in row),
        ),
      ).toBe(true);
      const unassigned = rows.find((row) => !row.assigned)!;
      await expect(getAssignedShift(unassigned.id)).rejects.toThrow(
        "not assigned",
      );
    }));
  it("joins idempotently, snapshots rate/role, audits once, bumps version and rejects stale admin edits", () =>
    rollback(async (tx, f) => {
      const shiftId = await f.create();
      const [before] = await tx
        .select()
        .from(shifts)
        .where(eq(shifts.id, shiftId));
      const joined = await joinShift(shiftId);
      expect(joined.alreadyAssigned).toBe(false);
      expect((await joinShift(shiftId)).assignmentId).toBe(joined.assignmentId);
      const [assignment] = await tx
        .select()
        .from(shiftAssignments)
        .where(eq(shiftAssignments.shiftId, shiftId));
      expect(assignment).toMatchObject({
        salaryRateCents: 65000,
        roleOnShift: "operator",
        status: "assigned",
      });
      expect(
        await tx.select().from(auditLogs).where(eq(auditLogs.shiftId, shiftId)),
      ).toHaveLength(1);
      await expect(
        bulkShiftsInTransaction(tx, f.actor, {
          operation: "team",
          shifts: [{ id: shiftId, updatedAt: before!.updatedAt.toISOString() }],
          assignments: [],
        }),
      ).rejects.toThrow("changed");
      await expect(
        updateShiftInTransaction(tx, f.actor, {
          shiftId,
          expectedUpdatedAt: before!.updatedAt.toISOString(),
          sellingLocationId: f.locationId,
          shiftDate: "2030-01-02",
          title: "Changed",
          assignments: [
            {
              employeeId: f.actor.employeeId,
              roleOnShift: "operator",
              salaryRateCents: 65000,
            },
          ],
          costs: [],
          intent: "publish",
        }),
      ).rejects.toThrow("changed");
    }));
  it.each(["assigned", "confirmed", "completed"] as const)(
    "blocks %s conflicts but allows a different date",
    (status) =>
      rollback(async (tx, f) => {
        await f.assign(await f.create(), status);
        const target = await f.create();
        expect(
          (await listScheduleShifts()).find((row) => row.id === target),
        ).toMatchObject({ conflict: true, canJoin: false });
        await expect(
          joinShiftInTransaction(tx, f.actor, target),
        ).rejects.toThrow("assignment on this date");
        expect(
          (
            await joinShiftInTransaction(
              tx,
              f.actor,
              await f.create({ shiftDate: "2030-01-01" }),
            )
          ).alreadyAssigned,
        ).toBe(false);
      }),
  );
  it("ignores draft, cancelled and deleted conflicts and reactivates a cancelled assignment", () =>
    rollback(async (tx, f) => {
      await f.assign(await f.create({ status: "draft" }), "assigned");
      await f.assign(await f.create({ status: "cancelled" }), "confirmed");
      await f.assign(await f.create({ deletedAt: new Date() }), "completed");
      await f.assign(await f.create(), "draft");
      const target = await f.create();
      const assignmentId = await f.assign(target, "cancelled");
      await tx
        .update(employees)
        .set({
          canUsePos: false,
          canLogProduction: false,
          defaultShiftRateCents: 50000,
        })
        .where(eq(employees.id, f.actor.employeeId));
      expect(
        (await joinShiftInTransaction(tx, f.actor, target)).assignmentId,
      ).toBe(assignmentId);
      expect(
        await tx
          .select()
          .from(shiftAssignments)
          .where(eq(shiftAssignments.shiftId, target)),
      ).toMatchObject([
        {
          id: assignmentId,
          roleOnShift: "employee",
          salaryRateCents: 50000,
          status: "assigned",
        },
      ]);
    }));
  it("rejects invalid lifecycles, elapsed scheduled start, actual start, past, deleted, foreign, and production-only joins", () =>
    rollback(async (tx, f) => {
      for (const values of [
        { status: "draft" as const },
        { status: "active" as const },
        { status: "closing" as const },
        { status: "closed" as const },
        { status: "cancelled" as const },
        { actualStartAt: new Date() },
        { scheduledStartAt: new Date(Date.now() - 1000) },
        { shiftDate: "2020-01-01" },
        { deletedAt: new Date() },
        { businessId: f.otherBusiness },
      ])
        await expect(
          joinShiftInTransaction(tx, f.actor, await f.create(values)),
        ).rejects.toThrow();
      await tx
        .update(employees)
        .set({ canUsePos: false, canLogProduction: true })
        .where(eq(employees.id, f.actor.employeeId));
      await expect(
        joinShiftInTransaction(tx, f.actor, await f.create()),
      ).rejects.toThrow("eligible employee");
      await expect(listScheduleShifts()).rejects.toThrow("production-only");
    }));
  it("rejects a prepared device reservation and permits joining after release", () =>
    rollback(async (tx, f) => {
      const shiftId = await f.create();
      const id = randomUUID();
      await tx.insert(offlineShiftSessions).values({
        id,
        shiftId,
        businessId: f.actor.businessId,
        userId: f.actor.userId,
        deviceId: "test-device",
        snapshotId: randomUUID(),
        snapshot: {},
      });
      expect(
        (await listScheduleShifts()).find((row) => row.id === shiftId),
      ).toMatchObject({
        canJoin: false,
        reason: expect.stringContaining("offline device"),
      });
      await expect(
        joinShiftInTransaction(tx, f.actor, shiftId),
      ).rejects.toThrow("prepared device");
      await tx
        .update(offlineShiftSessions)
        .set({ status: "released" })
        .where(eq(offlineShiftSessions.id, id));
      expect(
        (await joinShiftInTransaction(tx, f.actor, shiftId)).alreadyAssigned,
      ).toBe(false);
    }));
  it("RLS permits only eligible business employees to discover published rows; assignment/cost/sales and direct writes stay protected", () =>
    rollback(async (tx, f) => {
      const published = await f.create(),
        draft = await f.create({ status: "draft" });
      await f.create({ businessId: f.otherBusiness });
      await f.create({ status: "cancelled" });
      await f.create({ deletedAt: new Date() });
      const teammate = randomUUID();
      await tx.insert(employees).values({
        id: teammate,
        businessId: f.actor.businessId,
        displayName: "Teammate",
      });
      await tx.insert(shiftAssignments).values({
        id: randomUUID(),
        employeeId: teammate,
        businessId: f.actor.businessId,
        shiftId: published,
      });
      await tx.insert(shiftCosts).values({
        id: randomUUID(),
        businessId: f.actor.businessId,
        shiftId: published,
        costType: "rent",
        label: "Private",
        amountCents: 100,
      });
      await tx.execute(
        sql`insert into sales (id, business_id, shift_id, selling_location_id, sale_number) values (${randomUUID()}, ${f.actor.businessId}, ${published}, ${f.locationId}, 'private-sale')`,
      );
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: f.actor.userId })}, true)`,
      );
      await tx.execute(sql`set local role authenticated`);
      expect((await tx.select().from(shifts)).map((row) => row.id)).toEqual([
        published,
      ]);
      expect(await tx.select().from(shiftAssignments)).toEqual([]);
      expect(await tx.select().from(shiftCosts)).toEqual([]);
      expect(
        await tx.select({ id: tables.sales.id }).from(tables.sales),
      ).toEqual([]);
      // The full migration chain revokes setup DML; the reduced PGlite
      // fixture retains DML grants to exercise the RLS fallback as well.
      const update = tx.transaction((inner) =>
        inner
          .update(shifts)
          .set({ title: "Unauthorized" })
          .where(eq(shifts.id, published))
          .returning(),
      );
      await update.then(
        (rows) => expect(rows).toEqual([]),
        (error: { cause?: { code?: string } }) =>
          expect(error.cause?.code).toBe("42501"),
      );
      await expect(
        tx.transaction((inner) =>
          inner.insert(shiftAssignments).values({
            id: randomUUID(),
            businessId: f.actor.businessId,
            shiftId: published,
            employeeId: f.actor.employeeId,
          }),
        ),
      ).rejects.toThrow();
      await tx.execute(sql`reset role`);
      expect(
        (await tx.select().from(shifts).where(eq(shifts.id, draft)))[0]!.status,
      ).toBe("draft");
      await tx
        .update(employees)
        .set({ status: "inactive" })
        .where(eq(employees.id, f.actor.employeeId));
      await tx.execute(sql`set local role authenticated`);
      expect(await tx.select().from(shifts)).toEqual([]);
      await tx.execute(sql`reset role`);
    }));
});

// PGlite has a single connection; run these against disposable PostgreSQL to
// exercise real advisory and row lock waits, not a mocked concurrency model.
describe.skipIf(!connection)("schedule concurrency", () => {
  async function committed(
    test: (
      f: Awaited<ReturnType<typeof fixture>>,
      ids: string[],
    ) => Promise<void>,
  ) {
    const f = await database.transaction(fixture);
    context.database = database;
    const ids = await database.transaction(async (tx) => {
      const created: string[] = [];
      for (let index = 0; index < 3; index++) {
        const id = randomUUID();
        created.push(id);
        await tx.insert(shifts).values({
          id,
          businessId: f.actor.businessId,
          sellingLocationId: f.locationId,
          shiftDate: "2030-01-01",
          title: "Concurrent join",
        });
      }
      return created;
    });
    try {
      await test(f, ids);
    } finally {
      await database.transaction(async (tx) => {
        await tx
          .delete(shifts)
          .where(eq(shifts.businessId, f.actor.businessId));
        await tx
          .delete(businesses)
          .where(eq(businesses.id, f.actor.businessId));
        await tx.delete(businesses).where(eq(businesses.id, f.otherBusiness));
        await tx.delete(authUsers).where(eq(authUsers.id, f.actor.userId));
      });
    }
  }
  it("simultaneous joins on different shifts on the same date yield one assignment", () =>
    committed(async (f, ids) => {
      const results = await Promise.allSettled(
        ids.map((id) =>
          database.transaction((tx) => joinShiftInTransaction(tx, f.actor, id)),
        ),
      );
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(2);
      expect(
        await database
          .select()
          .from(shiftAssignments)
          .where(eq(shiftAssignments.employeeId, f.actor.employeeId)),
      ).toHaveLength(1);
    }));
  it("simultaneous duplicate requests produce one assignment and one audit event", () =>
    committed(async (f, ids) => {
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          database.transaction((tx) =>
            joinShiftInTransaction(tx, f.actor, ids[0]!),
          ),
        ),
      );
      expect(new Set(results.map((row) => row.assignmentId)).size).toBe(1);
      expect(results.filter((row) => !row.alreadyAssigned)).toHaveLength(1);
      expect(
        await database
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.shiftId, ids[0]!)),
      ).toHaveLength(1);
    }));
  it("admin changes wait for joins and reject stale versions after the join commits", () =>
    committed(async (f, ids) => {
      const [before] = await database
        .select()
        .from(shifts)
        .where(eq(shifts.id, ids[0]!));
      const edit = {
        operation: "team" as const,
        shifts: [
          { id: before!.id, updatedAt: before!.updatedAt.toISOString() },
        ],
        assignments: [
          {
            employeeId: f.actor.employeeId,
            roleOnShift: "operator" as const,
            salaryRateCents: 1,
          },
        ],
      };
      await database.transaction(async (tx) => {
        await joinShiftInTransaction(tx, f.actor, ids[0]!);
        await expect(
          database.transaction(async (admin) => {
            await admin.execute(sql`set local lock_timeout = '150ms'`);
            return bulkShiftsInTransaction(admin, f.actor, edit);
          }),
        ).rejects.toThrow();
      });
      await expect(
        database.transaction((tx) =>
          bulkShiftsInTransaction(tx, f.actor, edit),
        ),
      ).rejects.toThrow("changed");
    }));
  it("joins wait for admin date changes on another assigned shift, then recheck conflicts", () =>
    committed(async (f, ids) => {
      await database.insert(shiftAssignments).values({
        id: randomUUID(),
        businessId: f.actor.businessId,
        employeeId: f.actor.employeeId,
        shiftId: ids[1]!,
      });
      await database
        .update(shifts)
        .set({ shiftDate: "2030-01-02" })
        .where(eq(shifts.id, ids[1]!));
      await database.transaction(async (admin) => {
        const [before] = await admin
          .select()
          .from(shifts)
          .where(eq(shifts.id, ids[1]!));
        await updateShiftInTransaction(admin, f.actor, {
          shiftId: ids[1]!,
          expectedUpdatedAt: before!.updatedAt.toISOString(),
          sellingLocationId: f.locationId,
          shiftDate: "2030-01-01",
          title: "Rescheduled",
          assignments: [
            {
              employeeId: f.actor.employeeId,
              roleOnShift: "operator",
              salaryRateCents: 65000,
            },
          ],
          costs: [],
          intent: "publish",
        });
        await expect(
          database.transaction(async (join) => {
            await join.execute(sql`set local lock_timeout = '150ms'`);
            return joinShiftInTransaction(join, f.actor, ids[0]!);
          }),
        ).rejects.toThrow();
      });
      await expect(
        database.transaction((tx) =>
          joinShiftInTransaction(tx, f.actor, ids[0]!),
        ),
      ).rejects.toThrow("assignment on this date");
    }));
});
