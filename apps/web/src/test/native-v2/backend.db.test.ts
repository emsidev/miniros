import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import * as tables from "@miniros/db/schema";
import {
  canonicalV2,
  journalDigestV2,
  summaryV2,
  type V2Projection,
} from "@miniros/domain/v2";

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
import { cleanupFixtures, database, fixture, identity } from "./fixtures";
import { createNativeV2Service } from "@/server/services/native-v2/service";
import { ingestNativeInTransaction } from "@/server/services/native-v2/ingestion";
import { nativeHash } from "@/server/services/native-v2/crypto";
import { assertSameOrigin } from "@/server/services/offline-http";

beforeAll(() => {
  vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic.example.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
});
afterAll(async () => {
  await cleanupFixtures();
  vi.unstubAllEnvs();
});

describe("EP05 real PostgreSQL native ingestion", () => {
  it("the default-off rollout gate affects new authorities only, retaining existing snapshot and replay access", async () => {
    // The suite explicitly enabled creation before this first registration.
    const f = await fixture();
    const opening = await f.opening();
    const original = await f.service.ingest(f.identities.cashier, opening);
    vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "0");
    try {
      await expect(fixture()).rejects.toThrow(
        "New native shifts are not enabled",
      );
      expect(
        await f.service.registerSnapshot(f.identities.owner, {
          snapshot: f.snapshot,
          cashierInstallationId: f.installations.cashier,
        }),
      ).toMatchObject({ authorityId: f.authority.authorityId });
      expect(await f.service.ingest(f.identities.cashier, opening)).toEqual(
        original,
      );
      expect(
        (await f.service.ingest(f.identities.cashier, await f.sale())).ok,
      ).toBe(true);
    } finally {
      vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "1");
    }
  });
  it("independent shift requests and prep commands remain durable while another shift has a gap", async () => {
    const a = await fixture(),
      b = await fixture();
    const command = await a.prep(randomUUID(), "making");
    expect((await a.service.submitPrep(a.identities.prep, command)).ok).toBe(
      true,
    );
    expect((await a.projection()).lastSequence).toBe(0);
    const replies = await Promise.all([
      a.service.ingest(a.identities.cashier, await a.sale(3)),
      b.service.ingest(b.identities.cashier, await b.opening()),
    ]);
    expect(replies[0]).toMatchObject({ ok: false, code: "GAP_OR_CONFLICT" });
    expect(replies[1]!.ok).toBe(true);
    expect((await b.projection()).lastSequence).toBe(1);
    expect((await a.projection()).lastSequence).toBe(0);
  });
  it("T01 lost HTTP reply returns the durable original receipt and applies frozen sale effects once", async () => {
    const f = await fixture();
    const opening = await f.opening();
    expect((await f.service.ingest(f.identities.cashier, opening)).ok).toBe(
      true,
    );
    const sale = await f.sale();
    // Commit happened, then the caller discarded the response.
    await f.service.ingest(f.identities.cashier, sale);
    const original = (
      await database
        .select()
        .from(tables.v2Operations)
        .where(eq(tables.v2Operations.id, sale.operationId))
    )[0]!;
    f.setNow(new Date(f.now().getTime() + 1000));
    const retry = await f.service.ingest(f.identities.cashier, sale);
    expect(retry).toEqual({ ok: true, receipt: original.receipt });
    const p = (await f.projection()).projection as V2Projection;
    expect(summaryV2(p)).toMatchObject({
      grossSalesMinor: 100,
      discountsMinor: 10,
      refundsMinor: 0,
      netSalesMinor: 90,
      expectedCashMinor: 1090,
    });
    expect(p.stockAtoms[f.itemId]).toBe(9);
    expect(
      await database
        .select()
        .from(tables.v2Effects)
        .where(eq(tables.v2Effects.operationId, sale.operationId)),
    ).toHaveLength(1);
    expect(
      await database
        .select()
        .from(tables.sales)
        .where(eq(tables.sales.businessId, f.businessId)),
    ).toHaveLength(0);
    expect(
      await database
        .select()
        .from(tables.inventoryEvents)
        .where(eq(tables.inventoryEvents.businessId, f.businessId)),
    ).toHaveLength(0);
  });
  it("T02 gaps, changed digests and unsupported envelopes preserve evidence and contiguous high-water", async () => {
    const f = await fixture();
    await f.service.ingest(f.identities.cashier, await f.opening());
    const third = await f.sale(3);
    expect(await f.service.ingest(f.identities.cashier, third)).toMatchObject({
      ok: false,
      code: "GAP_OR_CONFLICT",
      expectedSequence: 2,
    });
    expect((await f.projection()).lastSequence).toBe(1);
    const second = await f.sale();
    const original = await f.service.ingest(f.identities.cashier, second);
    const changed = await f.operation(
      "CASH_ADJUSTMENT",
      { direction: "in", amountMinor: 99, reason: "Conflicting reuse" },
      2,
      { operationId: second.operationId },
    );
    expect(await f.service.ingest(f.identities.cashier, changed)).toMatchObject(
      { ok: false, code: "CONFLICT" },
    );
    expect(await f.service.ingest(f.identities.cashier, second)).toEqual(
      original,
    );
    const unsupported = { ...third, schemaVersion: 77 };
    expect(
      await f.service.ingest(f.identities.cashier, unsupported),
    ).toMatchObject({ ok: false, code: "UNSUPPORTED_OR_INVALID" });
    expect((await f.projection()).lastSequence).toBe(2);
    expect((await f.service.ingest(f.identities.cashier, third)).ok).toBe(true);
    const incidents = await database
      .select()
      .from(tables.v2IngestIncidents)
      .where(eq(tables.v2IngestIncidents.businessId, f.businessId));
    expect(incidents).toHaveLength(3);
    expect(
      incidents.find((row) => row.category === "GAP_OR_CONFLICT")!.evidence,
    ).toEqual({ envelope: third });
    expect(
      incidents.find((row) => row.category === "UNSUPPORTED_OR_INVALID")!
        .operationId,
    ).toBe(third.operationId);
    expect((await f.projection()).lastSequence).toBe(3);
  });
  it("T04 authentic signature plus exact role/installation/epoch/snapshot are mandatory", async () => {
    const f = await fixture();
    const valid = await f.opening();
    const invalidSignature = {
      ...valid,
      authenticity: {
        ...valid.authenticity,
        signature: Buffer.alloc(64).toString("base64"),
      },
    };
    expect(
      await f.service.ingest(f.identities.cashier, invalidSignature),
    ).toMatchObject({ ok: false, code: "SIGNATURE" });
    for (const patch of [
      { installationId: randomUUID() },
      { authorityEpoch: 2 },
      { snapshotHash: "a".repeat(64) },
      { snapshotId: randomUUID() },
    ]) {
      const candidate = await f.operation(
        "OPEN_SHIFT",
        valid.payload,
        1,
        patch,
      );
      expect(
        await f.service.ingest(f.identities.cashier, candidate),
      ).toMatchObject({ ok: false, code: "GRANT_SCOPE" });
    }
    const prepFinancial = await f.operation(
      "OPEN_SHIFT",
      valid.payload,
      1,
      {},
      "prep",
    );
    expect(
      await f.service.ingest(f.identities.prep, prepFinancial),
    ).toMatchObject({ ok: false, code: "ROLE" });
    const assignment = f.assignments.cashier!;
    await database
      .update(tables.shiftAssignments)
      .set({ status: "cancelled" })
      .where(eq(tables.shiftAssignments.id, assignment));
    expect(await f.service.ingest(f.identities.cashier, valid)).toMatchObject({
      ok: false,
      code: "ASSIGNMENT",
    });
    await database
      .update(tables.shiftAssignments)
      .set({ status: "assigned" })
      .where(eq(tables.shiftAssignments.id, assignment));
    expect((await f.service.ingest(f.identities.cashier, valid)).ok).toBe(true);
    const adjust = await f.operation(
      "ADJUST_STOCK",
      {
        itemId: f.itemId,
        deltaAtoms: 3,
        approvalId: randomUUID(),
        reason: "Invented approval",
      },
      2,
    );
    expect(await f.service.ingest(f.identities.cashier, adjust)).toMatchObject({
      ok: false,
      code: "CAPABILITY",
    });
    expect((await f.projection()).lastSequence).toBe(1);
  });
  it("T04 new expired/revoked evidence is quarantined but original receipts remain readable", async () => {
    const f = await fixture();
    const opening = await f.opening(),
      sale = await f.sale();
    const first = await f.service.ingest(f.identities.cashier, opening);
    f.setNow(new Date(f.grants.cashier.expiresAt.getTime()));
    expect(await f.service.ingest(f.identities.cashier, sale)).toMatchObject({
      ok: false,
      code: "EXPIRED",
    });
    expect(await f.service.ingest(f.identities.cashier, opening)).toEqual(
      first,
    );
    f.setNow(new Date(f.grants.cashier.issuedAt.getTime() + 1000));
    await f.service.revokeGrant(f.identities.owner, {
      businessId: f.businessId,
      shiftId: f.shiftId,
      grantId: f.grants.cashier.id,
      reason: "Owner revoked device",
    });
    expect(await f.service.ingest(f.identities.cashier, sale)).toMatchObject({
      ok: false,
      code: "REVOKED",
    });
    expect(await f.service.ingest(f.identities.cashier, opening)).toEqual(
      first,
    );
    const incidents = await database
      .select()
      .from(tables.v2IngestIncidents)
      .where(eq(tables.v2IngestIncidents.businessId, f.businessId));
    expect(incidents.map((row) => row.evidence)).toEqual([
      { envelope: sale },
      { envelope: sale },
    ]);
    expect((await f.projection()).lastSequence).toBe(1);
  });
  it("T05 fault after a real stock/cash effect and before receipt rolls the entire transaction back", async () => {
    const f = await fixture();
    const opening = await f.opening();
    let observedEffect = false;
    const faulting = createNativeV2Service(database, {
      now: f.now,
      fault: async (stage, tx) => {
        expect(stage).toBe("after-effects");
        observedEffect =
          (
            await tx
              .select()
              .from(tables.v2Effects)
              .where(eq(tables.v2Effects.operationId, opening.operationId))
          ).length === 1;
        expect(
          await tx
            .select()
            .from(tables.v2Operations)
            .where(eq(tables.v2Operations.id, opening.operationId)),
        ).toHaveLength(0);
        throw new Error("Injected receipt fault");
      },
    });
    await expect(
      faulting.ingest(f.identities.cashier, opening),
    ).rejects.toThrow("Injected receipt fault");
    expect(observedEffect).toBe(true);
    for (const table of [
      tables.v2Effects,
      tables.v2Operations,
      tables.v2CountSeals,
    ])
      expect(
        await database
          .select()
          .from(table)
          .where(eq(table.businessId, f.businessId)),
      ).toHaveLength(0);
    expect((await f.projection()).lastSequence).toBe(0);
    expect((await f.service.ingest(f.identities.cashier, opening)).ok).toBe(
      true,
    );
  });
  it("T07 separate real PostgreSQL backend PIDs race the same ingest into one effect and original receipt", async () => {
    const f = await fixture(),
      opening = await f.opening();
    const pids: number[] = [];
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const race = () =>
      database.transaction(async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(
          sql`select pg_backend_pid()::int as pid`,
        );
        pids.push(row!.pid);
        if (pids.length === 2) release();
        await barrier;
        return ingestNativeInTransaction(
          tx,
          f.identities.cashier,
          opening,
          f.now(),
          {},
        );
      });
    const replies = await Promise.all([race(), race()]);
    expect(new Set(pids).size).toBe(2);
    process.stdout.write(
      `EP05-T07 simultaneous PostgreSQL backend PIDs: ${pids.join(", ")}; distinct: true\n`,
    );
    expect(replies[0]).toEqual(replies[1]);
    expect(replies[0]!.ok).toBe(true);
    expect(
      await database
        .select()
        .from(tables.v2Effects)
        .where(eq(tables.v2Effects.businessId, f.businessId)),
    ).toHaveLength(1);
    expect((await f.projection()).lastSequence).toBe(1);
  });
  it("verified prep commands can be consumed once; cashier booleans and fabricated IDs grant nothing", async () => {
    const f = await fixture();
    await f.service.ingest(f.identities.cashier, await f.opening());
    const sale = await f.sale();
    await f.service.ingest(f.identities.cashier, sale);
    if (sale.kind !== "SALE") throw new Error("fixture");
    const invented = await f.operation(
      "RETURN_UNPREPARED",
      {
        saleId: sale.payload.saleId,
        prepCommandId: randomUUID(),
        prepConfirmedUnprepared: true,
        physicallyReturned: true,
        reason: "Not evidence",
      },
      3,
    );
    expect(
      await f.service.ingest(f.identities.cashier, invented),
    ).toMatchObject({ ok: false, code: "PREP_EVIDENCE" });
    const command = await f.prep(sale.payload.saleId, "unprepared-return");
    const acknowledgement = await f.service.submitPrep(
      f.identities.prep,
      command,
    );
    expect(acknowledgement.ok).toBe(true);
    expect(await f.service.submitPrep(f.identities.prep, command)).toEqual(
      acknowledgement,
    );
    await f.service.revokeGrant(f.identities.owner, {
      businessId: f.businessId,
      shiftId: f.shiftId,
      grantId: f.grants.prep.id,
      reason: "Revoke future commands",
    });
    const returned = await f.operation(
      "RETURN_UNPREPARED",
      {
        saleId: sale.payload.saleId,
        prepCommandId: command.commandId,
        prepConfirmedUnprepared: true,
        physicallyReturned: true,
        reason: "Physically returned",
      },
      3,
    );
    const receipt = await f.service.ingest(f.identities.cashier, returned);
    expect(receipt.ok).toBe(true);
    expect(await f.service.ingest(f.identities.cashier, returned)).toEqual(
      receipt,
    );
    const p = (await f.projection()).projection as V2Projection;
    expect(p.stockAtoms[f.itemId]).toBe(10);
    expect(summaryV2(p).netSalesMinor).toBe(90);
    expect(
      (
        await database
          .select()
          .from(tables.v2PrepCommands)
          .where(eq(tables.v2PrepCommands.id, command.commandId))
      )[0]!.appliedOperationId,
    ).toBe(returned.operationId);
  });
  it("close stores exact uncounted answers and pending attachments while permanently sealing the journal", async () => {
    const f = await fixture();
    await f.service.ingest(f.identities.cashier, await f.opening());
    const p = (await f.projection()).projection as V2Projection;
    const close = await f.operation(
      "CLOSE_SHIFT",
      {
        manifestId: randomUUID(),
        lastFinancialSequence: 1,
        journalDigest: await journalDigestV2(p, nativeHash),
        expectedCashMinor: 1000,
        netSalesMinor: 0,
        expectedStockAtoms: { [f.itemId]: 10 },
        actualCashMinor: null,
        counts: [{ itemId: f.itemId, kind: "uncounted" }],
        pendingAttachmentIds: [randomUUID()],
        manualResolutions: [],
      },
      2,
    );
    const receipt = await f.service.ingest(f.identities.cashier, close);
    expect(receipt.ok).toBe(true);
    expect((await f.projection()).state).toBe("closed");
    expect(
      await f.service.ingest(f.identities.cashier, await f.sale(3)),
    ).toMatchObject({ ok: false });
    expect(await f.service.ingest(f.identities.cashier, close)).toEqual(
      receipt,
    );
    const [manifest] = await database
      .select()
      .from(tables.v2CloseManifests)
      .where(eq(tables.v2CloseManifests.businessId, f.businessId));
    expect(manifest!.manifest).toEqual(close.payload);
    const [seal] = await database
      .select()
      .from(tables.v2CountSeals)
      .where(
        and(
          eq(tables.v2CountSeals.businessId, f.businessId),
          eq(tables.v2CountSeals.kind, "closing"),
        ),
      );
    expect(seal!.cashMinor).toBeNull();
    expect(seal!.counts).toEqual([{ itemId: f.itemId, kind: "uncounted" }]);
  });
  it("owner issuance and recovery require explicit same-business authority; imports never waive expiry", async () => {
    const f = await fixture();
    const opening = await f.opening();
    await expect(
      f.service.registerSnapshot(f.identities.cashier, {
        snapshot: f.snapshot,
        cashierInstallationId: f.installations.cashier,
      }),
    ).rejects.toThrow();
    await expect(
      f.service.registerSnapshot(f.identities.owner, {
        snapshot: f.snapshot,
        cashierInstallationId: randomUUID(),
      }),
    ).rejects.toThrow("immutable");
    expect(f.grants.cashier.allowedKinds).not.toContain("ADJUST_STOCK");
    const body = {
      packageId: randomUUID(),
      businessId: f.businessId,
      shiftId: f.shiftId,
      operations: [opening],
    };
    const request = {
      ...body,
      packageDigest: await nativeHash(canonicalV2(body)),
      reason: "Owner verified retained device evidence",
    };
    await expect(
      f.service.importRecovery(f.identities.cashier, request),
    ).rejects.toThrow();
    const result = await f.service.importRecovery(f.identities.owner, request);
    expect(result).toMatchObject({ ok: true, replies: [{ ok: true }] });
    expect(await f.service.importRecovery(f.identities.owner, request)).toEqual(
      result,
    );
    f.setNow(new Date(f.grants.cashier.expiresAt.getTime() + 1));
    const expiredBody = {
      ...body,
      packageId: randomUUID(),
      operations: [await f.sale()],
    };
    expect(
      await f.service.importRecovery(f.identities.owner, {
        ...expiredBody,
        packageDigest: await nativeHash(canonicalV2(expiredBody)),
        reason: "Review expired capability",
      }),
    ).toMatchObject({ ok: true, replies: [{ ok: false, code: "EXPIRED" }] });
    expect((await f.projection()).lastSequence).toBe(1);
  });
  it("T03 tenant B cannot read, write, sign or import tenant A; raw SQL grants and publication remain closed", async () => {
    const a = await fixture(),
      b = await fixture();
    await expect(
      a.service.ingest(b.identities.cashier, await a.opening()),
    ).rejects.toThrow();
    const rawTables = [
      "v2_snapshots",
      "v2_authorities",
      "v2_device_grants",
      "v2_operations",
      "v2_ingest_incidents",
      "v2_prep_commands",
      "v2_count_seals",
      "v2_close_manifests",
      "v2_recovery_imports",
      "v2_effects",
    ];
    const rows = await database.execute<{
      name: string;
      relrowsecurity: boolean;
      read: boolean;
      write: boolean;
    }>(sql`select c.relname as name, c.relrowsecurity,
      has_table_privilege('authenticated', c.oid, 'SELECT') as read, has_table_privilege('authenticated', c.oid, 'INSERT') as write
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname like 'v2_%'`);
    expect(rows).toHaveLength(rawTables.length);
    for (const row of rows)
      expect(row).toMatchObject({
        relrowsecurity: true,
        read: false,
        write: false,
      });
    const publication = await database.execute<{ tablename: string }>(
      sql`select tablename from pg_publication_tables where pubname='supabase_realtime'`,
    );
    expect(publication.some((row) => rawTables.includes(row.tablename))).toBe(
      false,
    );
    const bucket = await database.execute<{ public: boolean }>(
      sql`select public from storage.buckets where id='payment-proofs'`,
    );
    expect(bucket[0]!.public).toBe(false);
    const storagePolicies = await database.execute<{ cmd: string }>(
      sql`select cmd from pg_policies where schemaname='storage' and tablename='objects'`,
    );
    expect(
      storagePolicies.some((row) =>
        ["INSERT", "UPDATE", "ALL"].includes(row.cmd),
      ),
    ).toBe(false);
    await expect(
      database.transaction(async (tx) => {
        await tx.execute(sql`set local role authenticated`);
        return tx.select().from(tables.v2Snapshots);
      }),
    ).rejects.toThrow();
    expect(() =>
      assertSameOrigin(new Request("http://localhost/api/offline/sync")),
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost/api/offline/sync", {
          headers: { origin: "http://foreign.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertSameOrigin(
        new Request("http://localhost/api/offline/sync", {
          headers: { origin: "http://localhost" },
        }),
      ),
    ).not.toThrow();
    await database
      .update(tables.businessMembers)
      .set({ status: "disabled" })
      .where(eq(tables.businessMembers.id, a.members.cashier!));
    await expect(
      a.service.ingest(await identity(a.userIds.cashier), await a.opening()),
    ).rejects.toThrow();
  });
});
