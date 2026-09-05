import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@miniros/db";
import * as tables from "@miniros/db/schema";
const context = vi.hoisted(() => ({
  database: null as unknown as Database,
  user: null as unknown as User,
  businessId: "",
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
      getUser: async () => ({ data: { user: context.user }, error: null }),
    },
  }),
}));
import { claimMembershipInvitations } from "./invitations";
import { getShiftSaleHistory } from "./shift-sale-history";
const pg = new PGlite();
const database = drizzle(pg, { schema: tables });
const migrationDirectory = resolve(process.cwd(), "../../supabase/migrations");
const fixMigration = "20260905071237_security_server_write_boundaries.sql";
const ids = Object.fromEntries(
  [
    "user",
    "business",
    "otherBusiness",
    "member",
    "employee",
    "location",
    "shift",
    "sale",
    "payment",
    "file",
    "poison",
  ].map((key) => [key, randomUUID()]),
) as Record<string, string>;
async function asUser<T>(work: () => Promise<T>) {
  await pg.exec("set role authenticated");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [
    ids.user,
  ]);
  try {
    return await work();
  } finally {
    await pg.exec("reset role");
  }
}
beforeAll(async () => {
  await pg.exec(`create schema auth; create table auth.users(id uuid primary key);
    create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create schema storage;
    create table storage.buckets(id text primary key, name text, public boolean);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    create function storage.filename(name text) returns text language sql immutable as $$ select (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;`);
  for (const file of readdirSync(migrationDirectory)
    .filter(
      (f) =>
        f.endsWith(".sql") &&
        f !== fixMigration &&
        !f.includes("operational_realtime"),
    )
    .sort()) {
    await pg.exec(readFileSync(resolve(migrationDirectory, file), "utf8"));
  }
  context.database = database as unknown as Database;
  await database.insert(tables.authUsers).values({ id: ids.user });
  await database.insert(tables.businesses).values([
    { id: ids.business, name: "A" },
    { id: ids.otherBusiness, name: "B" },
  ]);
  await database.insert(tables.businessMembers).values({
    id: ids.member,
    businessId: ids.business,
    authUserId: ids.user,
    role: "owner",
    status: "active",
  });
  await database.insert(tables.employees).values({
    id: ids.employee,
    businessId: ids.business,
    memberId: ids.member,
    displayName: "Operator",
    canUsePos: true,
  });
  await database
    .insert(tables.sellingLocations)
    .values({ id: ids.location, businessId: ids.business, name: "Booth" });
  await database.insert(tables.shifts).values({
    id: ids.shift,
    businessId: ids.business,
    sellingLocationId: ids.location,
    shiftDate: "2026-09-05",
    status: "active",
  });
  await database.insert(tables.shiftAssignments).values({
    id: randomUUID(),
    businessId: ids.business,
    shiftId: ids.shift,
    employeeId: ids.employee,
    roleOnShift: "operator",
    status: "assigned",
  });
  await database.insert(tables.sales).values({
    id: ids.sale,
    businessId: ids.business,
    shiftId: ids.shift,
    sellingLocationId: ids.location,
    saleNumber: "test-sale",
    totalCents: 100,
    amountPaidCents: 100,
  });
  await database.insert(tables.payments).values({
    id: ids.payment,
    businessId: ids.business,
    saleId: ids.sale,
    paymentMethod: "gcash",
    amountCents: 100,
    referenceNumber: "private-reference",
  });
  context.user = {
    id: ids.user,
    email: "operator@example.test",
    email_confirmed_at: new Date().toISOString(),
  } as User;
  context.businessId = ids.business;
}, 60_000);
afterAll(() => pg.close());

describe("security service and SQL boundaries", () => {
  it("closes direct tenant-reference poisoning and legacy proof writes while retaining linked reads", async () => {
    const otherShift = randomUUID();
    await database.insert(tables.shifts).values({
      id: otherShift,
      businessId: ids.otherBusiness,
      sellingLocationId: ids.location,
      shiftDate: "2026-09-06",
    });
    const poison = () =>
      pg.query(
        "insert into public.inventory_locations(id,business_id,shift_id,name,location_type) values($1,$2,$3,'poison','shift')",
        [ids.poison, ids.business, otherShift],
      );
    // Establish the original boundary failure with the shipped prior policies.
    await asUser(poison);
    await database
      .delete(tables.inventoryLocations)
      .where(eq(tables.inventoryLocations.id, ids.poison!));
    const legacy = `${ids.business}/payments/${ids.payment}/unlinked.html`;
    await asUser(() =>
      pg.query(
        "insert into storage.objects(bucket_id,name) values('payment-proofs',$1)",
        [legacy],
      ),
    );
    const linked = `${ids.business}/payments/${ids.payment}/digest/proof.jpg`;
    await pg.query(
      "insert into storage.objects(bucket_id,name) values('payment-proofs',$1)",
      [linked],
    );
    await database.insert(tables.files).values({
      id: ids.file,
      businessId: ids.business,
      bucketId: "payment-proofs",
      objectPath: linked,
      fileType: "payment_proof",
    });
    await database
      .update(tables.payments)
      .set({ proofFileId: ids.file })
      .where(eq(tables.payments.id, ids.payment!));
    await pg.exec(
      readFileSync(resolve(migrationDirectory, fixMigration), "utf8"),
    );
    await expect(asUser(poison)).rejects.toThrow(/permission denied/);
    await expect(
      asUser(() =>
        pg.query("update public.inventory_locations set shift_id=$1", [
          otherShift,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(() =>
        pg.query(
          "insert into storage.objects(bucket_id,name) values('payment-proofs',$1)",
          [legacy + "2"],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const changed = await asUser(() =>
      pg.query(
        "update storage.objects set name='changed' where name=$1 returning name",
        [legacy],
      ),
    );
    expect(changed.rows).toEqual([]);
    const readable = await asUser(() =>
      pg.query<{ name: string }>(
        "select name from storage.objects where bucket_id='payment-proofs'",
      ),
    );
    expect(readable.rows.map((row) => row.name)).toEqual([linked]);
    const grants = await pg.query<{ write: boolean }>(
      "select has_table_privilege('service_role','public.inventory_locations','INSERT') as write",
    );
    expect(grants.rows[0]?.write).toBe(true);
  });
  it("leaves unverified invitations pending, then claims once after email confirmation", async () => {
    const inviteId = randomUUID(),
      userId = randomUUID();
    await database.insert(tables.authUsers).values({ id: userId });
    await database.insert(tables.businessMembers).values({
      id: inviteId,
      businessId: ids.business,
      invitedEmail: "invite@example.test",
      role: "admin",
      status: "pending",
    });
    const user = { id: userId, email: "Invite@Example.Test" } as User;
    expect(await claimMembershipInvitations(user)).toEqual([]);
    const [pending] = await database
      .select()
      .from(tables.businessMembers)
      .where(eq(tables.businessMembers.id, inviteId));
    expect(pending).toMatchObject({ status: "pending", authUserId: null });
    expect(
      await claimMembershipInvitations({
        ...user,
        email_confirmed_at: new Date().toISOString(),
      }),
    ).toEqual([ids.business]);
    expect(
      await claimMembershipInvitations({
        ...user,
        email_confirmed_at: new Date().toISOString(),
      }),
    ).toEqual([]);
  });
  it("revokes sales history when POS permission is removed without losing assignment", async () => {
    await database
      .update(tables.businessMembers)
      .set({ role: "employee" })
      .where(eq(tables.businessMembers.id, ids.member!));
    const history = await getShiftSaleHistory(ids.shift!);
    expect(history.sales[0]?.payments[0]?.referenceNumber).toBe(
      "private-reference",
    );
    await database
      .update(tables.employees)
      .set({ canUsePos: false })
      .where(eq(tables.employees.id, ids.employee!));
    await expect(getShiftSaleHistory(ids.shift!)).rejects.toThrow(
      /POS permission/,
    );
    await database
      .update(tables.employees)
      .set({ canUsePos: true })
      .where(eq(tables.employees.id, ids.employee!));
    expect((await getShiftSaleHistory(ids.shift!)).sales).toHaveLength(1);
  });
});
