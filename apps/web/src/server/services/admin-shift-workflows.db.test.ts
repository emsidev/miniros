import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@miniros/db";
import { createDatabase, createPostgresClient } from "@miniros/db";
import {
  authUsers,
  businesses,
  businessMembers,
  employees,
  sellingLocations,
  shiftAssignments,
  shiftCosts,
  shifts,
} from "@miniros/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import {
  createShiftsInTransaction,
  bulkShiftsInTransaction,
  updateShiftInTransaction,
} from "./admin-shift-workflows";
import type { ShiftTransaction } from "./admin-shift-persistence";
import { planningTotals, type ShiftCreateInput } from "@/lib/shift-planning";
import { requireActiveBusiness } from "./access";
import { getAssignedShift, listAssignedShifts } from "./operator";

const pageContext = vi.hoisted(() => ({
  userId: "",
  businessId: "",
  database: null as unknown as Database,
}));
vi.mock("@miniros/db", async (original) => ({
  ...(await original<typeof import("@miniros/db")>()),
  requireDatabase: () => pageContext.database,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: pageContext.businessId }) }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: pageContext.userId } },
        error: null,
      }),
    },
  }),
}));

// Opt in explicitly. Fixtures use random identities; normal cases roll back all
// writes, and the concurrency case deletes its isolated fixture in finally.
const connection = process.env.SHIFT_TEST_DATABASE_URL;
const database = connection ? createDatabase(connection) : null;
afterAll(async () => {
  if (connection) await createPostgresClient(connection).end();
});

async function fixture(tx: ShiftTransaction) {
  const ids = {
    business: randomUUID(),
    otherBusiness: randomUUID(),
    owner: randomUUID(),
    user: randomUUID(),
    member: randomUUID(),
    operator: randomUUID(),
    helper: randomUUID(),
    foreignEmployee: randomUUID(),
    location: randomUUID(),
    foreignLocation: randomUUID(),
  };
  await tx.insert(authUsers).values([{ id: ids.owner }, { id: ids.user }]);
  await tx.insert(businesses).values([
    { id: ids.business, name: "Shift workflow test", createdBy: ids.owner },
    {
      id: ids.otherBusiness,
      name: "Foreign shift workflow test",
      createdBy: ids.owner,
    },
  ]);
  await tx.insert(businessMembers).values([
    {
      id: randomUUID(),
      businessId: ids.business,
      authUserId: ids.owner,
      role: "owner",
      status: "active",
    },
    {
      id: ids.member,
      businessId: ids.business,
      authUserId: ids.user,
      role: "employee",
      status: "active",
    },
  ]);
  await tx.insert(employees).values([
    {
      id: ids.operator,
      businessId: ids.business,
      memberId: ids.member,
      displayName: "Test POS operator",
      canUsePos: true,
      defaultShiftRateCents: 65000,
    },
    {
      id: ids.helper,
      businessId: ids.business,
      displayName: "Test helper",
      defaultShiftRateCents: 50000,
    },
    {
      id: ids.foreignEmployee,
      businessId: ids.otherBusiness,
      displayName: "Other business employee",
      canUsePos: true,
    },
  ]);
  await tx.insert(sellingLocations).values([
    {
      id: ids.location,
      businessId: ids.business,
      name: "Test market",
      defaultRentalCostCents: 150000,
      defaultTransportCostCents: 50000,
    },
    {
      id: ids.foreignLocation,
      businessId: ids.otherBusiness,
      name: "Other market",
    },
  ]);
  const actor = {
    businessId: ids.business,
    userId: ids.owner,
    employeeId: null,
  };
  const team = [
    {
      employeeId: ids.operator,
      roleOnShift: "operator" as const,
      salaryRateCents: 65000,
    },
  ];
  const plan: ShiftCreateInput = {
    sellingLocationId: ids.location,
    title: "",
    shiftDates: ["2030-01-01"],
    assignments: team,
    costs: [
      { costType: "rent", label: "Rent", amountCents: 150000 },
      { costType: "transport", label: "Transport", amountCents: 50000 },
      {
        costType: "other",
        label: "Permit",
        amountCents: 1234,
        notes: "Keep this note",
      },
    ],
    intent: "draft",
    requestId: randomUUID(),
  };
  return { ids, actor, team, plan };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function rolledBack(
  test: (tx: ShiftTransaction, f: Fixture) => Promise<void>,
) {
  const rollback = new Error("fixture rollback");
  try {
    await database!.transaction(async (tx) => {
      const f = await fixture(tx);
      await test(tx, f);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}
async function versions(tx: ShiftTransaction, ids: string[]) {
  return (await tx.select().from(shifts).where(inArray(shifts.id, ids))).map(
    (row) => ({ id: row.id, updatedAt: row.updatedAt.toISOString() }),
  );
}

describe.skipIf(!connection)("admin shift database workflows", () => {
  it("denies employee page and direct-URL access to drafts, then allows the published schedule", () =>
    rolledBack(async (tx, { ids, actor, plan }) => {
      pageContext.database = tx as unknown as Database;
      pageContext.userId = ids.user;
      pageContext.businessId = ids.business;
      const { shiftIds } = await createShiftsInTransaction(tx, actor, plan);
      expect(await listAssignedShifts()).toEqual([]);
      await expect(
        requireActiveBusiness({ assignedShiftId: shiftIds[0]! }),
      ).rejects.toThrow("not assigned");
      await expect(getAssignedShift(shiftIds[0]!)).rejects.toThrow(
        "not assigned",
      );
      await bulkShiftsInTransaction(tx, actor, {
        operation: "publish",
        shifts: await versions(tx, shiftIds),
      });
      expect((await listAssignedShifts()).map((shift) => shift.id)).toEqual(
        shiftIds,
      );
      expect((await getAssignedShift(shiftIds[0]!)).status).toBe("scheduled");
    }));
  it("creates multi-date unstaffed drafts, safely retries, and rejects changed retry payloads", () =>
    rolledBack(async (tx, { actor, plan }) => {
      const input = {
        ...plan,
        assignments: [],
        shiftDates: ["2030-01-01", "2030-01-03"],
      };
      const result = await createShiftsInTransaction(tx, actor, input);
      expect(result.createdCount).toBe(2);
      expect(await createShiftsInTransaction(tx, actor, input)).toEqual(result);
      expect(
        (
          await tx
            .select()
            .from(shifts)
            .where(eq(shifts.businessId, actor.businessId))
        ).map((row) => row.status),
      ).toEqual(["draft", "draft"]);
      await expect(
        createShiftsInTransaction(tx, actor, { ...input, title: "Different" }),
      ).rejects.toThrow("earlier request was saved");
    }));

  it("hides draft shifts, assignments, and costs at the RLS boundary and exposes published assignments", () =>
    rolledBack(async (tx, { ids, actor, plan }) => {
      const { shiftIds } = await createShiftsInTransaction(tx, actor, plan);
      const inspect = async (userId: string) => {
        await tx.execute(
          sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`,
        );
        await tx.execute(sql`set local role authenticated`);
        try {
          return {
            shifts: await tx
              .select()
              .from(shifts)
              .where(eq(shifts.id, shiftIds[0]!)),
            assignments: await tx
              .select()
              .from(shiftAssignments)
              .where(eq(shiftAssignments.shiftId, shiftIds[0]!)),
            costs: await tx
              .select()
              .from(shiftCosts)
              .where(eq(shiftCosts.shiftId, shiftIds[0]!)),
          };
        } finally {
          await tx.execute(sql`reset role`);
        }
      };
      expect(await inspect(ids.user)).toEqual({
        shifts: [],
        assignments: [],
        costs: [],
      });
      expect((await inspect(ids.owner)).shifts).toHaveLength(1);
      await bulkShiftsInTransaction(tx, actor, {
        operation: "publish",
        shifts: await versions(tx, shiftIds),
      });
      const published = await inspect(ids.user);
      expect(published.shifts[0]?.status).toBe("scheduled");
      expect(published.assignments[0]?.status).toBe("assigned");
      expect(published.costs).toHaveLength(3);
      expect(await inspect(randomUUID())).toEqual({
        shifts: [],
        assignments: [],
        costs: [],
      });
    }));

  it("rejects unavailable and foreign staff/locations before publication, with staff-specific errors", () =>
    rolledBack(async (tx, { ids, actor, plan }) => {
      for (const sellingLocationId of [ids.foreignLocation, randomUUID()])
        await expect(
          createShiftsInTransaction(tx, actor, {
            ...plan,
            sellingLocationId,
            intent: "publish",
          }),
        ).rejects.toThrow("selling location");
      for (const employeeId of [ids.helper, ids.foreignEmployee])
        await expect(
          createShiftsInTransaction(tx, actor, {
            ...plan,
            intent: "publish",
            assignments: [{ ...plan.assignments[0]!, employeeId }],
          }),
        ).rejects.toMatchObject({
          fieldErrors: expect.objectContaining({
            [employeeId === ids.helper
              ? "assignments.0.roleOnShift"
              : "assignments.0.employeeId"]: expect.any(Array),
          }),
        });
      await tx
        .update(employees)
        .set({ status: "inactive" })
        .where(eq(employees.id, ids.operator));
      const draft = await createShiftsInTransaction(tx, actor, plan);
      await expect(
        bulkShiftsInTransaction(tx, actor, {
          operation: "publish",
          shifts: await versions(tx, draft.shiftIds),
        }),
      ).rejects.toThrow("team members");
      await tx
        .update(sellingLocations)
        .set({ status: "inactive" })
        .where(eq(sellingLocations.id, ids.location));
      await expect(
        createShiftsInTransaction(tx, actor, {
          ...plan,
          intent: "publish",
          requestId: randomUUID(),
        }),
      ).rejects.toThrow("selling location");
    }));

  it("preserves itemized cost IDs and notes, replaces team pay, and excludes removed assignments", () =>
    rolledBack(async (tx, { ids, actor, plan }) => {
      const { shiftIds } = await createShiftsInTransaction(tx, actor, {
        ...plan,
        intent: "publish",
        assignments: [
          ...plan.assignments,
          {
            employeeId: ids.helper,
            roleOnShift: "employee",
            salaryRateCents: 50000,
          },
        ],
      });
      const savedCosts = await tx
        .select()
        .from(shiftCosts)
        .where(eq(shiftCosts.shiftId, shiftIds[0]!));
      const version = (await versions(tx, shiftIds))[0]!;
      await updateShiftInTransaction(tx, actor, {
        sellingLocationId: ids.location,
        title: "New title",
        shiftId: version.id,
        expectedUpdatedAt: version.updatedAt,
        shiftDate: "2030-01-02",
        assignments: [{ ...plan.assignments[0]!, salaryRateCents: 70000 }],
        costs: savedCosts.map((cost) => ({
          ...cost,
          amountCents: cost.costType === "rent" ? 160000 : cost.amountCents,
        })),
        intent: "publish",
      });
      const costs = await tx
        .select()
        .from(shiftCosts)
        .where(eq(shiftCosts.shiftId, version.id));
      expect(costs.map((cost) => cost.id).sort()).toEqual(
        savedCosts.map((cost) => cost.id).sort(),
      );
      expect(costs.find((cost) => cost.costType === "other")?.notes).toBe(
        "Keep this note",
      );
      const team = await tx
        .select()
        .from(shiftAssignments)
        .where(eq(shiftAssignments.shiftId, version.id));
      expect(team.find((item) => item.employeeId === ids.helper)?.status).toBe(
        "cancelled",
      );
      expect(planningTotals(team, costs).totalCents).toBe(281234);
      await expect(
        updateShiftInTransaction(tx, actor, {
          ...plan,
          shiftId: version.id,
          expectedUpdatedAt: version.updatedAt,
          shiftDate: "2030-01-02",
          intent: "publish",
        }),
      ).rejects.toThrow("changed");
    }));

  it("validates every bulk selection and rolls back writes after an actual database failure", () =>
    rolledBack(async (tx, { actor, plan }) => {
      const { shiftIds } = await createShiftsInTransaction(tx, actor, {
        ...plan,
        shiftDates: ["2030-01-01", "2030-01-02"],
      });
      const before = await versions(tx, shiftIds);
      // The audit foreign key fails after the first shift and assignments were updated.
      await expect(
        tx.transaction((inner) =>
          bulkShiftsInTransaction(
            inner,
            { ...actor, userId: randomUUID() },
            { operation: "publish", shifts: before },
          ),
        ),
      ).rejects.toThrow();
      expect(
        (
          await tx.select().from(shifts).where(inArray(shifts.id, shiftIds))
        ).map((row) => row.status),
      ).toEqual(["draft", "draft"]);
      expect(
        (
          await tx
            .select()
            .from(shiftAssignments)
            .where(inArray(shiftAssignments.shiftId, shiftIds))
        ).map((row) => row.status),
      ).toEqual(["draft", "draft"]);
      await tx
        .update(shifts)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(shifts.id, shiftIds[1]!));
      await expect(
        bulkShiftsInTransaction(tx, actor, {
          operation: "cancel",
          shifts: await versions(tx, shiftIds),
        }),
      ).rejects.toThrow("Only draft and scheduled");
      expect(
        (await tx.select().from(shifts).where(eq(shifts.id, shiftIds[0]!)))[0]
          ?.status,
      ).toBe("draft");
    }));

  it("replaces a mixed draft/scheduled team's snapshots together, publishes, and cancels to history", () =>
    rolledBack(async (tx, { actor, plan }) => {
      const draft = await createShiftsInTransaction(tx, actor, plan);
      const published = await createShiftsInTransaction(tx, actor, {
        ...plan,
        requestId: randomUUID(),
        intent: "publish",
      });
      const ids = [...draft.shiftIds, ...published.shiftIds];
      await bulkShiftsInTransaction(tx, actor, {
        operation: "team",
        shifts: await versions(tx, ids),
        assignments: [{ ...plan.assignments[0]!, salaryRateCents: 72000 }],
      });
      const assigned = await tx
        .select()
        .from(shiftAssignments)
        .where(inArray(shiftAssignments.shiftId, ids));
      expect(assigned.every((row) => row.salaryRateCents === 72000)).toBe(true);
      expect(new Set(assigned.map((row) => row.status))).toEqual(
        new Set(["draft", "assigned"]),
      );
      await expect(
        bulkShiftsInTransaction(tx, actor, {
          operation: "publish",
          shifts: await versions(tx, ids),
        }),
      ).rejects.toThrow("only drafts");
      await bulkShiftsInTransaction(tx, actor, {
        operation: "publish",
        shifts: await versions(tx, draft.shiftIds),
      });
      await bulkShiftsInTransaction(tx, actor, {
        operation: "cancel",
        shifts: await versions(tx, ids),
      });
      expect(
        (await tx.select().from(shifts).where(inArray(shifts.id, ids))).every(
          (row) => row.status === "cancelled",
        ),
      ).toBe(true);
      expect(
        (
          await tx
            .select()
            .from(shiftAssignments)
            .where(inArray(shiftAssignments.shiftId, ids))
        ).every((row) => row.status === "cancelled"),
      ).toBe(true);
    }));

  it("locks against a concurrent shift start and rejects the stale admin edit after it starts", async () => {
    const f = await database!.transaction(fixture);
    try {
      const { shiftIds } = await database!.transaction((tx) =>
        createShiftsInTransaction(tx, f.actor, {
          ...f.plan,
          intent: "publish",
        }),
      );
      const before = await database!.transaction((tx) =>
        versions(tx, shiftIds),
      );
      await database!.transaction(async (startTx) => {
        await startTx
          .select()
          .from(shifts)
          .where(eq(shifts.id, shiftIds[0]!))
          .for("update");
        await expect(
          database!.transaction(async (adminTx) => {
            await adminTx.execute(sql`set local lock_timeout = '250ms'`);
            await bulkShiftsInTransaction(adminTx, f.actor, {
              operation: "team",
              shifts: before,
              assignments: f.team,
            });
          }),
        ).rejects.toThrow();
        await startTx
          .update(shifts)
          .set({
            status: "active",
            actualStartAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(shifts.id, shiftIds[0]!));
      });
      await expect(
        database!.transaction((tx) =>
          bulkShiftsInTransaction(tx, f.actor, {
            operation: "cancel",
            shifts: before,
          }),
        ),
      ).rejects.toThrow("changed");
    } finally {
      await database!.transaction(async (tx) => {
        await tx.delete(shifts).where(eq(shifts.businessId, f.ids.business));
        await tx
          .delete(businesses)
          .where(inArray(businesses.id, [f.ids.business, f.ids.otherBusiness]));
        await tx
          .delete(authUsers)
          .where(inArray(authUsers.id, [f.ids.owner, f.ids.user]));
      });
    }
  });
});
