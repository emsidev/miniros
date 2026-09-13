import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createDatabase } from "@miniros/db";
import * as tables from "@miniros/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import {
  createV2Snapshot,
  sealV2Operation,
  sealV2PrepCommand,
  type V2OperationBody,
  type V2PrepCommandBody,
} from "@miniros/domain/v2";
import { authenticateNative } from "@/server/services/native-v2/auth";
import { nativeHash } from "@/server/services/native-v2/crypto";
import { createNativeV2Service } from "@/server/services/native-v2/service";
import { assertDisposableDatabase } from "@/test/isolation-guard";

export const connection = process.env.SHIFT_TEST_DATABASE_URL;
if (!connection)
  throw new Error(
    "Native PostgreSQL integration requires SHIFT_TEST_DATABASE_URL; zero-test/skip success is not accepted.",
  );
assertDisposableDatabase(connection);
export const database = createDatabase(connection);
export const businessFixtures: { businessId: string; users: string[] }[] = [];
export async function identity(userId: string) {
  return authenticateNative(
    new Request("http://localhost/api/native/v2/ingest", {
      headers: { authorization: `Bearer ${userId}` },
    }),
  );
}
export async function fixture() {
  const businessId = randomUUID(),
    shiftId = randomUUID(),
    locationId = randomUUID();
  const userIds = {
    owner: randomUUID(),
    cashier: randomUUID(),
    prep: randomUUID(),
  };
  const employees: Record<string, string> = {},
    members: Record<string, string> = {},
    assignments: Record<string, string> = {};
  await database
    .insert(tables.authUsers)
    .values(Object.values(userIds).map((id) => ({ id })));
  await database
    .insert(tables.businesses)
    .values({ id: businessId, name: "EP05 disposable fixture" });
  await database
    .insert(tables.sellingLocations)
    .values({ id: locationId, businessId, name: "Synthetic booth" });
  await database.insert(tables.shifts).values({
    id: shiftId,
    businessId,
    sellingLocationId: locationId,
    shiftDate: "2026-09-07",
    status: "scheduled",
  });
  for (const role of ["owner", "cashier", "prep"] as const) {
    const memberId = randomUUID(),
      employeeId = randomUUID(),
      assignmentId = randomUUID();
    members[role] = memberId;
    employees[role] = employeeId;
    assignments[role] = assignmentId;
    await database.insert(tables.businessMembers).values({
      id: memberId,
      businessId,
      authUserId: userIds[role],
      role: role === "owner" ? "owner" : "employee",
      status: "active",
    });
    await database.insert(tables.employees).values({
      id: employeeId,
      businessId,
      memberId,
      displayName: role,
      canUsePos: role === "cashier",
      canLogProduction: role === "prep",
    });
    await database.insert(tables.shiftAssignments).values({
      id: assignmentId,
      businessId,
      shiftId,
      employeeId,
      roleOnShift: role === "cashier" ? "operator" : "employee",
      status: "assigned",
    });
  }
  businessFixtures.push({ businessId, users: Object.values(userIds) });
  const itemId = randomUUID(),
    recipeId = randomUUID(),
    productId = randomUUID();
  const snapshot = await createV2Snapshot(
    {
      schemaVersion: 2,
      id: randomUUID(),
      businessId,
      shiftId,
      version: 1,
      catalogVersion: "frozen-1",
      recipeVersion: "frozen-1",
      costingVersion: "frozen-1",
      checklist: { id: randomUUID(), version: 1, entries: [] },
      items: [
        {
          id: itemId,
          name: "Prepared serving",
          category: "Prepared",
          unit: "pc",
          atomScale: 1,
          prepared: true,
          unitCostMinor: 35,
          packs: [],
        },
      ],
      recipes: [
        { id: recipeId, ingredients: [{ kind: "item", itemId, atoms: 1 }] },
      ],
      products: [
        {
          id: productId,
          name: "Frozen item",
          priceMinor: 100,
          costMinor: 35,
          recipeId,
          modifierIds: [],
        },
      ],
      modifiers: [],
    },
    nativeHash,
  );
  const keys = {
    cashier: generateKeyPairSync("ed25519"),
    prep: generateKeyPairSync("ed25519"),
  };
  const installations = { cashier: randomUUID(), prep: randomUUID() };
  const identities = {
    owner: await identity(userIds.owner),
    cashier: await identity(userIds.cashier),
    prep: await identity(userIds.prep),
  };
  let now = new Date("2026-09-07T14:00:00.000Z");
  const service = createNativeV2Service(database, { now: () => now });
  const authority = await service.registerSnapshot(identities.owner, {
    snapshot,
    cashierInstallationId: installations.cashier,
  });
  const grants = {
    cashier: await service.issueGrant(identities.owner, {
      businessId,
      shiftId,
      userId: userIds.cashier,
      installationId: installations.cashier,
      role: "cashier",
      grantSpki: keys.cashier.publicKey
        .export({ type: "spki", format: "pem" })
        .toString(),
      ttlSeconds: 3600,
    }),
    prep: await service.issueGrant(identities.owner, {
      businessId,
      shiftId,
      userId: userIds.prep,
      installationId: installations.prep,
      role: "prep",
      grantSpki: keys.prep.publicKey
        .export({ type: "spki", format: "pem" })
        .toString(),
      ttlSeconds: 3600,
    }),
  };
  async function operation(
    kind: V2OperationBody["kind"],
    payload: unknown,
    sequence: number,
    overrides: Record<string, unknown> = {},
    role: "cashier" | "prep" = "cashier",
  ) {
    const body = {
      protocolVersion: 2,
      schemaVersion: 2,
      operationId: randomUUID(),
      businessId,
      shiftId,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.hash,
      installationId: installations[role],
      authorityEpoch: 1,
      sequence,
      occurredAt: now.toISOString(),
      kind,
      payload,
      ...overrides,
    };
    const placeholder = {
      scheme: "ed25519" as const,
      grantId: grants[role].id,
      signature: Buffer.alloc(64).toString("base64"),
    };
    const draft = await sealV2Operation(body, placeholder, nativeHash);
    return sealV2Operation(
      body,
      {
        ...placeholder,
        signature: sign(
          null,
          Buffer.from(draft.canonicalDigest, "utf8"),
          keys[role].privateKey,
        ).toString("base64"),
      },
      nativeHash,
    );
  }
  async function prep(saleId: string, action: V2PrepCommandBody["action"]) {
    const body = {
      schemaVersion: 2,
      protocolVersion: 2,
      commandId: randomUUID(),
      businessId,
      shiftId,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.hash,
      installationId: installations.prep,
      authorityEpoch: 1,
      saleId,
      action,
      occurredAt: now.toISOString(),
    };
    const placeholder = {
      scheme: "ed25519" as const,
      grantId: grants.prep.id,
      signature: Buffer.alloc(64).toString("base64"),
    };
    const draft = await sealV2PrepCommand(body, placeholder, nativeHash);
    return sealV2PrepCommand(
      body,
      {
        ...placeholder,
        signature: sign(
          null,
          Buffer.from(draft.canonicalDigest, "utf8"),
          keys.prep.privateKey,
        ).toString("base64"),
      },
      nativeHash,
    );
  }
  const opening = () =>
    operation(
      "OPEN_SHIFT",
      {
        counts: [{ itemId, kind: "counted", atoms: 10 }],
        openingCashMinor: 1000,
        reviewed: true,
      },
      1,
    );
  const sale = (sequence = 2, saleId = randomUUID()) =>
    operation(
      "SALE",
      {
        saleId,
        lines: [{ productId, quantity: 1, modifierIds: [] }],
        discountMinor: 10,
        tenders: [{ method: "cash", tenderedMinor: 100, changeMinor: 10 }],
      },
      sequence,
    );
  const projection = async () =>
    (
      await database
        .select()
        .from(tables.v2Authorities)
        .where(
          and(
            eq(tables.v2Authorities.businessId, businessId),
            eq(tables.v2Authorities.id, authority.authorityId),
          ),
        )
    )[0]!;
  return {
    businessId,
    shiftId,
    locationId,
    userIds,
    employees,
    members,
    assignments,
    snapshot,
    itemId,
    productId,
    keys,
    installations,
    identities,
    service,
    grants,
    authority,
    operation,
    prep,
    opening,
    sale,
    projection,
    now: () => now,
    setNow: (value: Date) => {
      now = value;
    },
  };
}
export async function cleanupFixtures() {
  for (const f of businessFixtures) {
    await database.transaction(async (tx) => {
      for (const table of [
        tables.v2RecoveryImports,
        tables.v2PrepCommands,
        tables.v2CountSeals,
        tables.v2CloseManifests,
        tables.v2Effects,
        tables.v2Operations,
        tables.v2IngestIncidents,
        tables.v2DeviceGrants,
        tables.v2Authorities,
        tables.v2Snapshots,
        tables.auditLogs,
        tables.shiftAssignments,
        tables.shifts,
        tables.sellingLocations,
        tables.employees,
        tables.businessMembers,
      ]) {
        await tx.delete(table).where(eq(table.businessId, f.businessId));
      }
      await tx
        .delete(tables.businesses)
        .where(eq(tables.businesses.id, f.businessId));
      await tx
        .delete(tables.authUsers)
        .where(inArray(tables.authUsers.id, f.users));
    });
  }
}
