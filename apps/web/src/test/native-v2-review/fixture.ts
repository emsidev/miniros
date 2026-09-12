import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from "node:crypto";
import { createDatabase } from "@miniros/db";
import { sql } from "drizzle-orm";
import {
  canonicalV2,
  createV2Snapshot,
  operationBodyV2,
  sealV2Operation,
  sealV2PrepCommand,
  type V2Kind,
  type V2OperationBody,
  type V2Payloads,
  type V2PrepCommandBody,
} from "@miniros/domain/v2";
import { authenticateNative } from "../../server/services/native-v2/auth";
import { createNativeV2Service } from "../../server/services/native-v2/service";
import { assertDisposableDatabase } from "../isolation-guard";

export const url = "postgres://127.0.0.1:55432/miniros_ep00_disposable";
assertDisposableDatabase(url);
export const db = createDatabase(url);
export const hash = async (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const initialAt = new Date("2026-09-07T00:00:00.000Z");
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
    snapshotId = randomUUID(),
    ownerId = randomUUID(),
    cashierId = randomUUID(),
    prepId = randomUUID(),
    strangerId = randomUUID();
  const cashierInstallationId = randomUUID(),
    prepInstallationId = randomUUID(),
    locationId = randomUUID(),
    itemId = randomUUID(),
    recipeId = randomUUID(),
    productId = randomUUID();
  const cashierEmployeeId = randomUUID(),
    cashierAssignmentId = randomUUID();
  await db.transaction(async (tx) => {
    for (const userId of [ownerId, cashierId, prepId, strangerId])
      await tx.execute(sql`INSERT INTO auth.users(id) VALUES(${userId})`);
    await tx.execute(
      sql`INSERT INTO businesses(id,name) VALUES(${businessId},'Independent EP05 review fixture')`,
    );
    await tx.execute(
      sql`INSERT INTO selling_locations(id,business_id,name) VALUES(${locationId},${businessId},'Review booth')`,
    );
    await tx.execute(
      sql`INSERT INTO shifts(id,business_id,selling_location_id,shift_date) VALUES(${shiftId},${businessId},${locationId},'2026-09-07')`,
    );
    for (const [index, userId] of [ownerId, cashierId, prepId].entries()) {
      const memberId = randomUUID(),
        employeeId = index === 1 ? cashierEmployeeId : randomUUID(),
        assignmentId = index === 1 ? cashierAssignmentId : randomUUID();
      await tx.execute(
        sql`INSERT INTO business_members(id,business_id,auth_user_id,role,status) VALUES(${memberId},${businessId},${userId},${index === 0 ? "owner" : "employee"},'active')`,
      );
      if (index) {
        await tx.execute(
          sql`INSERT INTO employees(id,business_id,member_id,display_name,can_use_pos,can_log_production) VALUES(${employeeId},${businessId},${memberId},'Review staff',${index === 1},${index === 2})`,
        );
        await tx.execute(
          sql`INSERT INTO shift_assignments(id,business_id,shift_id,employee_id,role_on_shift) VALUES(${assignmentId},${businessId},${shiftId},${employeeId},${index === 1 ? "operator" : "employee"})`,
        );
      }
    }
  });
  const snapshot = await createV2Snapshot(
    {
      schemaVersion: 2,
      id: snapshotId,
      businessId,
      shiftId,
      version: 1,
      catalogVersion: "review-catalog",
      recipeVersion: "review-recipe",
      costingVersion: "review-cost",
      checklist: { id: randomUUID(), version: 1, entries: [] },
      items: [
        {
          id: itemId,
          name: "Cup",
          category: "Packaging",
          unit: "pc",
          atomScale: 1,
          prepared: false,
          unitCostMinor: 20,
          packs: [],
        },
      ],
      recipes: [
        { id: recipeId, ingredients: [{ kind: "item", itemId, atoms: 1 }] },
      ],
      products: [
        {
          id: productId,
          name: "Tea",
          priceMinor: 500,
          costMinor: 20,
          recipeId,
          modifierIds: [],
        },
      ],
      modifiers: [],
    },
    hash,
  );
  const owner = await identity(ownerId),
    cashier = await identity(cashierId),
    prep = await identity(prepId),
    stranger = await identity(strangerId);
  let at = new Date(initialAt);
  const service = createNativeV2Service(db, { now: () => new Date(at) });
  const cashierKey = generateKeyPairSync("ed25519"),
    prepKey = generateKeyPairSync("ed25519");
  await service.registerSnapshot(owner, { snapshot, cashierInstallationId });
  const grantRequest = {
    businessId,
    shiftId,
    userId: cashierId,
    installationId: cashierInstallationId,
    role: "cashier",
    grantSpki: cashierKey.publicKey
      .export({ format: "pem", type: "spki" })
      .toString(),
    ttlSeconds: 86400,
  };
  const grant = await service.issueGrant(owner, grantRequest);
  const prepGrant = await service.issueGrant(owner, {
    ...grantRequest,
    userId: prepId,
    installationId: prepInstallationId,
    role: "prep",
    grantSpki: prepKey.publicKey
      .export({ format: "pem", type: "spki" })
      .toString(),
  });
  const scope = {
    protocolVersion: 2 as const,
    schemaVersion: 2 as const,
    businessId,
    shiftId,
    snapshotId,
    snapshotHash: snapshot.hash,
    installationId: cashierInstallationId,
    authorityEpoch: 1,
    occurredAt: initialAt.toISOString(),
  };
  async function operation<K extends V2Kind>(
    kind: K,
    payload: V2Payloads[K],
    sequence: number,
    operationId: string = randomUUID(),
    key: KeyObject = cashierKey.privateKey,
    grantId = grant.id,
  ) {
    const unsigned = await sealV2Operation(
      { ...scope, operationId, sequence, kind, payload } as V2OperationBody,
      {
        scheme: "ed25519",
        grantId,
        signature: Buffer.alloc(64).toString("base64"),
      },
      hash,
    );
    return {
      ...unsigned,
      authenticity: {
        ...unsigned.authenticity,
        signature: sign(
          null,
          Buffer.from(unsigned.canonicalDigest),
          key,
        ).toString("base64"),
      },
    };
  }
  const opening = await operation(
    "OPEN_SHIFT",
    {
      counts: [{ itemId, kind: "counted", atoms: 10 }],
      openingCashMinor: 1000,
      reviewed: true,
    },
    1,
  );
  const sale = await operation(
    "SALE",
    {
      saleId: randomUUID(),
      lines: [{ productId, quantity: 1, modifierIds: [] }],
      discountMinor: 0,
      tenders: [{ method: "cash", tenderedMinor: 1000, changeMinor: 500 }],
    },
    2,
  );
  async function command(
    action: V2PrepCommandBody["action"],
    saleId: string,
    commandId: string = randomUUID(),
  ) {
    const unsigned = await sealV2PrepCommand(
      {
        ...scope,
        installationId: prepInstallationId,
        commandId,
        action,
        saleId,
      },
      {
        scheme: "ed25519",
        grantId: prepGrant.id,
        signature: Buffer.alloc(64).toString("base64"),
      },
      hash,
    );
    return {
      ...unsigned,
      authenticity: {
        ...unsigned.authenticity,
        signature: sign(
          null,
          Buffer.from(unsigned.canonicalDigest),
          prepKey.privateKey,
        ).toString("base64"),
      },
    };
  }
  return {
    businessId,
    shiftId,
    itemId,
    productId,
    ownerId,
    cashierId,
    prepId,
    owner,
    cashier,
    prep,
    stranger,
    cashierEmployeeId,
    cashierAssignmentId,
    cashierInstallationId,
    prepInstallationId,
    snapshot,
    service,
    grant,
    prepGrant,
    grantRequest,
    cashierKey,
    prepKey,
    opening,
    sale,
    operation,
    command,
    setTime: (value: Date) => {
      at = value;
    },
  };
}
export { canonicalV2, operationBodyV2 };
