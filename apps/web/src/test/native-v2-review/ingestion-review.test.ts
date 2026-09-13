import { createHash, generateKeyPairSync, randomUUID } from "node:crypto";
import { createPostgresClient } from "@miniros/db";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createNativeV2Service } from "../../server/services/native-v2/service";
import { authenticateNative } from "../../server/services/native-v2/auth";
import { canonicalV2, db, fixture, hash, initialAt, url } from "./fixture";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === "rejected"
          ? { data: { user: null }, error: new Error("rejected") }
          : { data: { user: { id: token } }, error: null },
    },
  }),
}));
beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://synthetic-review.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "synthetic-review-key");
  vi.stubEnv("MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED", "1");
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await createPostgresClient(url).end();
});
async function counts(businessId: string) {
  const result = await db.execute(
    sql`SELECT (SELECT count(*)::int FROM v2_operations WHERE business_id=${businessId}) AS operations,(SELECT count(*)::int FROM v2_effects WHERE business_id=${businessId}) AS effects,(SELECT count(*)::int FROM v2_ingest_incidents WHERE business_id=${businessId}) AS incidents,(SELECT last_sequence::int FROM v2_authorities WHERE business_id=${businessId}) AS sequence`,
  );
  return result[0];
}

describe("EP05 independent real PostgreSQL auth, atomicity and isolation", () => {
  it("EP05-T06 unsupported versions retain bounded own-scope fingerprints and preserve accepted work", async () => {
    const h = await fixture();
    await h.service.ingest(h.cashier, h.opening);
    const unknown = {
      ...h.sale,
      protocolVersion: 99,
      unexpectedSecret: "do-not-copy-this-credential",
    };
    expect(await h.service.ingest(h.cashier, unknown)).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_OR_INVALID",
    });
    const [incident] = await db.execute(
      sql`SELECT evidence FROM v2_ingest_incidents WHERE business_id=${h.businessId}`,
    );
    expect(incident?.evidence).toMatchObject({
      unsupportedOrInvalid: true,
      rawDigest: await hash(canonicalV2(unknown)),
    });
    expect(JSON.stringify(incident)).not.toContain(
      "do-not-copy-this-credential",
    );
    expect(await counts(h.businessId)).toMatchObject({
      operations: 1,
      effects: 1,
      incidents: 1,
      sequence: 1,
    });
  });

  it("EP05-T04 requires validated Bearer identity and rejects plain object identity", async () => {
    await expect(
      authenticateNative(
        new Request("http://localhost", {
          headers: { cookie: "access_token=pretend" },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      authenticateNative(
        new Request("http://localhost", {
          headers: { authorization: "Bearer rejected" },
        }),
      ),
    ).rejects.toThrow();
    const h = await fixture();
    await expect(
      h.service.ingest({ userId: h.cashierId } as never, h.opening),
    ).rejects.toThrow();
    expect(await counts(h.businessId)).toMatchObject({
      operations: 0,
      effects: 0,
      incidents: 0,
    });
  });

  it("EP05-T01/T07 commits exactly once under simultaneous requests and retains the original retry receipt", async () => {
    const h = await fixture();
    const pids: number[] = [],
      transaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementation((work, config) =>
      transaction(async (tx) => {
        const result = await tx.execute(sql`SELECT pg_backend_pid() AS pid`);
        pids.push(Number(result[0]!.pid));
        await tx.execute(sql`SELECT pg_sleep(0.05)`);
        return work(tx);
      }, config),
    );
    let replies;
    try {
      replies = await Promise.all([
        h.service.ingest(h.cashier, h.opening),
        h.service.ingest(h.cashier, h.opening),
      ]);
    } finally {
      spy.mockRestore();
    }
    expect(new Set(pids).size).toBe(2);
    expect(replies[0]).toEqual(replies[1]);
    expect(replies[0]?.ok).toBe(true);
    expect(await counts(h.businessId)).toMatchObject({
      operations: 1,
      effects: 1,
      incidents: 0,
      sequence: 1,
    });
    const sold = await h.service.ingest(h.cashier, h.sale);
    expect(sold.ok).toBe(true);
    h.setTime(new Date("2026-09-09T00:00:00.000Z"));
    expect(await h.service.ingest(h.cashier, h.sale)).toEqual(sold);
    const [projection] = await db.execute(
      sql`SELECT projection FROM v2_authorities WHERE business_id=${h.businessId}`,
    );
    expect(projection!.projection).toMatchObject({
      grossSalesMinor: 500,
      stockAtoms: { [h.itemId]: 9 },
      lastSequence: 2,
    });
  });

  it("EP05-T05 failure after effects rolls back effects, operation, receipt, counts and projection before retry", async () => {
    const h = await fixture();
    let backendPid = 0;
    const failing = createNativeV2Service(db, {
      now: () => initialAt,
      fault: async (_stage, tx) => {
        const result = await tx.execute(sql`SELECT pg_backend_pid() AS pid`);
        backendPid = Number(result[0]!.pid);
        throw new Error("independent fail after effects");
      },
    });
    await expect(failing.ingest(h.cashier, h.opening)).rejects.toThrow(
      "independent fail after effects",
    );
    expect(backendPid).toBeGreaterThan(0);
    expect(await counts(h.businessId)).toMatchObject({
      operations: 0,
      effects: 0,
      incidents: 0,
      sequence: 0,
    });
    expect(
      await db.execute(
        sql`SELECT id FROM v2_count_seals WHERE business_id=${h.businessId}`,
      ),
    ).toHaveLength(0);
    expect((await h.service.ingest(h.cashier, h.opening)).ok).toBe(true);
    expect(await counts(h.businessId)).toMatchObject({
      operations: 1,
      effects: 1,
      sequence: 1,
    });
  });

  it("EP05-T02 quarantines changed payload, invalid signature, duplicate sequence and gaps without effects", async () => {
    const h = await fixture();
    await h.service.ingest(h.cashier, h.opening);
    if (h.opening.kind !== "OPEN_SHIFT") throw new Error("fixture");
    const changed = await h.operation(
      "OPEN_SHIFT",
      { ...h.opening.payload, openingCashMinor: 2000 },
      1,
      h.opening.operationId,
    );
    expect(await h.service.ingest(h.cashier, changed)).toMatchObject({
      ok: false,
      code: "CONFLICT",
    });
    if (h.sale.kind !== "SALE") throw new Error("fixture");
    const forged = await h.operation(
      "SALE",
      h.sale.payload,
      2,
      randomUUID(),
      generateKeyPairSync("ed25519").privateKey,
    );
    expect(await h.service.ingest(h.cashier, forged)).toMatchObject({
      ok: false,
      code: "SIGNATURE",
    });
    const gap = await h.operation("SALE", h.sale.payload, 3);
    expect(await h.service.ingest(h.cashier, gap)).toMatchObject({
      ok: false,
      code: "GAP_OR_CONFLICT",
      expectedSequence: 2,
    });
    const collision = await h.operation("SALE", h.sale.payload, 1);
    expect(await h.service.ingest(h.cashier, collision)).toMatchObject({
      ok: false,
      code: "GAP_OR_CONFLICT",
    });
    expect(await counts(h.businessId)).toMatchObject({
      operations: 1,
      effects: 1,
      incidents: 4,
      sequence: 1,
    });
    const rows = await db.execute(
      sql`SELECT evidence FROM v2_ingest_incidents WHERE business_id=${h.businessId}`,
    );
    expect(
      rows.every((row) => JSON.stringify(row.evidence).includes(h.businessId)),
    ).toBe(true);
  });

  it("EP05-T03 foreign account/business cannot obtain receipts or create evidence in another business", async () => {
    const h = await fixture(),
      other = await fixture();
    await h.service.ingest(h.cashier, h.opening);
    await expect(h.service.ingest(h.stranger, h.opening)).rejects.toThrow();
    await expect(h.service.ingest(other.cashier, h.opening)).rejects.toThrow();
    expect(await h.service.ingest(h.prep, h.opening)).toMatchObject({
      ok: false,
      code: "GRANT_SCOPE",
    });
    expect(await counts(h.businessId)).toMatchObject({
      operations: 1,
      effects: 1,
      incidents: 1,
    });
    expect(await counts(other.businessId)).toMatchObject({
      operations: 0,
      effects: 0,
      incidents: 0,
    });
  });

  it.each(["expired", "revoked", "assignment", "permission"])(
    "EP05-T04 preserves %s evidence and original receipts while denying new effects",
    async (mode) => {
      const h = await fixture();
      const saved = await h.service.ingest(h.cashier, h.opening);
      if (mode === "expired") h.setTime(new Date("2026-09-08T00:00:00.000Z"));
      if (mode === "revoked")
        await h.service.revokeGrant(h.owner, {
          businessId: h.businessId,
          shiftId: h.shiftId,
          grantId: h.grant.id,
          reason: "Review revoked device",
        });
      if (mode === "assignment")
        await db.execute(
          sql`UPDATE shift_assignments SET status='cancelled' WHERE id=${h.cashierAssignmentId}`,
        );
      if (mode === "permission")
        await db.execute(
          sql`UPDATE employees SET can_use_pos=false WHERE id=${h.cashierEmployeeId}`,
        );
      expect(await h.service.ingest(h.cashier, h.sale)).toMatchObject({
        ok: false,
        code:
          mode === "expired"
            ? "EXPIRED"
            : mode === "revoked"
              ? "REVOKED"
              : "ASSIGNMENT",
      });
      expect(await h.service.ingest(h.cashier, h.opening)).toEqual(saved);
      expect(await counts(h.businessId)).toMatchObject({
        operations: 1,
        effects: 1,
        incidents: 1,
        sequence: 1,
      });
    },
  );

  it("EP05-T04 authentic prep commands cannot write journal money and forged prep evidence cannot authorize returns", async () => {
    const h = await fixture();
    await h.service.ingest(h.cashier, h.opening);
    await h.service.ingest(h.cashier, h.sale);
    if (h.sale.kind !== "SALE") throw new Error("fixture");
    const noProof = await h.operation(
      "RETURN_UNPREPARED",
      {
        saleId: h.sale.payload.saleId,
        prepCommandId: randomUUID(),
        prepConfirmedUnprepared: true,
        physicallyReturned: true,
        reason: "Review return",
      },
      3,
    );
    expect(await h.service.ingest(h.cashier, noProof)).toMatchObject({
      ok: false,
      code: "PREP_EVIDENCE",
    });
    const command = await h.command("making", h.sale.payload.saleId);
    const accepted = await h.service.submitPrep(h.prep, command);
    expect(accepted.ok).toBe(true);
    expect(await h.service.submitPrep(h.prep, command)).toEqual(accepted);
    expect(await counts(h.businessId)).toMatchObject({
      operations: 2,
      effects: 2,
      sequence: 2,
    });
    const recorded = await h.operation(
      "PREP_TRANSITION",
      {
        saleId: h.sale.payload.saleId,
        commandId: command.commandId,
        prepInstallationId: h.prepInstallationId,
        next: "making",
      },
      3,
    );
    expect((await h.service.ingest(h.cashier, recorded)).ok).toBe(true);
    const usedAgain = await h.operation(
      "PREP_TRANSITION",
      recorded.kind === "PREP_TRANSITION" ? recorded.payload : ({} as never),
      4,
    );
    expect(await h.service.ingest(h.cashier, usedAgain)).toMatchObject({
      ok: false,
      code: "PREP_EVIDENCE",
    });
    expect(h.grant.allowedKinds).not.toContain("ADJUST_STOCK");
    const adjust = await h.operation(
      "ADJUST_STOCK",
      {
        itemId: h.itemId,
        deltaAtoms: 1,
        approvalId: randomUUID(),
        reason: "Untrusted approval",
      },
      4,
    );
    expect(await h.service.ingest(h.cashier, adjust)).toMatchObject({
      ok: false,
      code: "CAPABILITY",
    });
  });

  it("Owner recovery preserves original signatures, deduplicates package and does not waive expiry", async () => {
    const h = await fixture();
    const packageBody = {
      businessId: h.businessId,
      shiftId: h.shiftId,
      packageId: randomUUID(),
      operations: [h.opening, h.sale],
    };
    const pkg = {
      ...packageBody,
      packageDigest: await hash(canonicalV2(packageBody)),
      reason: "Review independent owner recovery",
    };
    await expect(h.service.importRecovery(h.cashier, pkg)).rejects.toThrow();
    const result = await h.service.importRecovery(h.owner, pkg);
    expect(result).toMatchObject({
      ok: true,
      replies: [{ ok: true }, { ok: true }],
    });
    expect(await h.service.importRecovery(h.owner, pkg)).toEqual(result);
    expect(await counts(h.businessId)).toMatchObject({
      operations: 2,
      effects: 2,
      sequence: 2,
    });
    if (h.sale.kind !== "SALE") throw new Error("fixture");
    const later = await h.operation(
      "SALE",
      { ...h.sale.payload, saleId: randomUUID() },
      3,
    );
    h.setTime(new Date("2026-09-09T00:00:00.000Z"));
    const next = {
      ...packageBody,
      packageId: randomUUID(),
      operations: [later],
    };
    expect(
      await h.service.importRecovery(h.owner, {
        ...next,
        packageDigest: createHash("sha256")
          .update(canonicalV2(next))
          .digest("hex"),
        reason: "Expired recovery",
      }),
    ).toMatchObject({ ok: true, replies: [{ ok: false, code: "EXPIRED" }] });
    expect(await counts(h.businessId)).toMatchObject({
      operations: 2,
      effects: 2,
      incidents: 1,
    });
  });

  it("EP05-T03 real catalog denies raw privileges for every native table and excludes replication/public policies", async () => {
    const tables = await db.execute(
      sql`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'v2\_%' ESCAPE '\' ORDER BY c.relname`,
    );
    expect(tables).toHaveLength(10);
    expect(tables.every((row) => row.relrowsecurity === true)).toBe(true);
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const row of tables) {
        const [privileges] = await db.execute(
          sql`SELECT has_table_privilege(${role},${`public.${row.relname}`},'SELECT') AS readable,has_table_privilege(${role},${`public.${row.relname}`},'INSERT') AS writable,has_table_privilege(${role},${`public.${row.relname}`},'UPDATE') AS mutable,has_table_privilege(${role},${`public.${row.relname}`},'DELETE') AS deletable`,
        );
        expect(privileges).toEqual({
          readable: false,
          writable: false,
          mutable: false,
          deletable: false,
        });
      }
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`));
          return tx.execute(sql`SELECT * FROM v2_operations`);
        }),
      ).rejects.toThrow();
    }
    expect(
      await db.execute(
        sql`SELECT * FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'v2\_%' ESCAPE '\'`,
      ),
    ).toHaveLength(0);
    expect(
      await db.execute(
        sql`SELECT * FROM pg_publication_tables WHERE schemaname='public' AND tablename LIKE 'v2\_%' ESCAPE '\'`,
      ),
    ).toHaveLength(0);
  });

  it("Actual composite constraints reject foreign scopes and orphan effects at transaction commit", async () => {
    const h = await fixture(),
      other = await fixture();
    await h.service.ingest(h.cashier, h.opening);
    const [deferred] = await db.execute(
      sql`SELECT condeferrable,condeferred FROM pg_constraint WHERE conrelid='v2_effects'::regclass AND contype='f' AND confrelid='v2_operations'::regclass`,
    );
    expect(deferred).toEqual({ condeferrable: true, condeferred: true });
    await expect(
      db.transaction((tx) =>
        tx.execute(
          sql`UPDATE v2_device_grants SET assignment_id=${other.cashierAssignmentId} WHERE id=${h.grant.id}`,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      db.transaction((tx) =>
        tx.execute(
          sql`UPDATE v2_device_grants SET snapshot_hash=${"a".repeat(64)} WHERE id=${h.grant.id}`,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      db.transaction((tx) =>
        tx.execute(
          sql`UPDATE v2_device_grants SET expires_at=issued_at+interval '24 hours 1 second' WHERE id=${h.grant.id}`,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      db.transaction((tx) =>
        tx.execute(
          sql`UPDATE v2_effects SET shift_id=${other.shiftId} WHERE business_id=${h.businessId}`,
        ),
      ),
    ).rejects.toThrow();
    await expect(
      db.transaction((tx) =>
        tx.execute(
          sql`UPDATE v2_effects SET operation_id=${randomUUID()} WHERE business_id=${h.businessId}`,
        ),
      ),
    ).rejects.toThrow();
    expect(await counts(h.businessId)).toMatchObject({
      operations: 1,
      effects: 1,
      sequence: 1,
    });
  });
});
