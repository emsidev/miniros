import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  createV2Snapshot,
  sealV2Operation,
  v2Kinds,
  type V2Actor,
  type V2Draft,
  type V2Operation,
  type V2Receipt,
  type V2Snapshot,
} from "@miniros/domain/v2";
import { LocalSqliteConnection } from "../../src/storage/v2/connection";
import { LedgerRepository } from "../../src/storage/v2/repository";
import type {
  FaultHook,
  RawSqliteConnection,
  SqlParameter,
  StorageAuthority,
  StorageIdentity,
} from "../../src/storage/v2/types";
export const uuid = (number: number) =>
  `10000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export const ids = {
  account: uuid(1),
  business: uuid(2),
  shift: uuid(3),
  installation: uuid(4),
  snapshot: uuid(5),
  item: uuid(6),
  recipe: uuid(7),
  product: uuid(8),
  draft: uuid(9),
  sale: uuid(10),
  open: uuid(11),
  saleOperation: uuid(12),
  attachment: uuid(13),
};
export const hash = async (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const identity: StorageIdentity = {
  accountId: ids.account,
  businessId: ids.business,
  installationId: ids.installation,
  locked: false,
};
export const actor: V2Actor = {
  businessId: ids.business,
  shiftId: ids.shift,
  installationId: ids.installation,
  cashierInstallationId: ids.installation,
  authorityEpoch: 1,
  role: "cashier",
  allowedKinds: v2Kinds,
};
export const scope = { shiftId: ids.shift, authorityEpoch: 1 };
export const line = { productId: ids.product, quantity: 1, modifierIds: [] };
/** This synthetic test authority is deliberately not exported by the production module. */
export function fixtureAuthority(
  current: () => StorageIdentity | null = () => identity,
): StorageAuthority {
  return {
    currentIdentity: current,
    async authorizeSnapshot() {
      return actor;
    },
    async authorizeOperation() {
      return actor;
    },
    async authorizeReceipt() {},
  };
}
export class NodeRaw implements RawSqliteConnection {
  readonly db: DatabaseSync;
  constructor(
    readonly path: string,
    readOnly = false,
  ) {
    this.db = new DatabaseSync(path, { readOnly });
  }
  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }
  async run(
    sql: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<{ changes: number }> {
    const result = this.db.prepare(sql).run(...parameters);
    return { changes: Number(result.changes) };
  }
  async all<T>(
    sql: string,
    parameters: readonly SqlParameter[] = [],
  ): Promise<T[]> {
    return this.db.prepare(sql).all(...parameters) as T[];
  }
  async close(): Promise<void> {
    this.db.close();
  }
}
export async function fixtureSnapshot(): Promise<V2Snapshot> {
  return createV2Snapshot(
    {
      schemaVersion: 2,
      id: ids.snapshot,
      businessId: ids.business,
      shiftId: ids.shift,
      version: 1,
      catalogVersion: "synthetic-v1",
      recipeVersion: "synthetic-v1",
      costingVersion: "synthetic-v1",
      checklist: {
        id: uuid(15),
        version: 1,
        entries: [{ id: uuid(16), label: "Gloves", critical: true }],
      },
      items: [
        {
          id: ids.item,
          name: "Prepared portion",
          category: "Prepared",
          unit: "pc",
          atomScale: 1,
          prepared: true,
          unitCostMinor: 40,
          packs: [],
        },
      ],
      recipes: [
        {
          id: ids.recipe,
          ingredients: [{ kind: "item", itemId: ids.item, atoms: 1 }],
        },
      ],
      products: [
        {
          id: ids.product,
          name: "Synthetic drink",
          priceMinor: 200,
          costMinor: 40,
          recipeId: ids.recipe,
          modifierIds: [],
        },
      ],
      modifiers: [],
    },
    hash,
  );
}
export async function operations(
  snapshot: V2Snapshot,
): Promise<{ opening: V2Operation; sale: V2Operation; draft: V2Draft }> {
  const common = {
    protocolVersion: 2,
    schemaVersion: 2,
    businessId: ids.business,
    shiftId: ids.shift,
    snapshotId: snapshot.id,
    snapshotHash: snapshot.hash,
    installationId: ids.installation,
    authorityEpoch: 1,
    occurredAt: "2026-09-07T12:00:00.000Z",
  };
  const authenticity = {
    scheme: "ed25519",
    grantId: uuid(17),
    signature: "A".repeat(86) + "==",
  } as const;
  const opening = await sealV2Operation(
    {
      ...common,
      operationId: ids.open,
      sequence: 1,
      kind: "OPEN_SHIFT",
      payload: {
        reviewed: true,
        openingCashMinor: 1000,
        counts: [{ itemId: ids.item, kind: "counted", atoms: 1000 }],
      },
    },
    authenticity,
    hash,
  );
  const sale = await sealV2Operation(
    {
      ...common,
      operationId: ids.saleOperation,
      sequence: 2,
      kind: "SALE",
      payload: {
        saleId: ids.sale,
        lines: [line],
        discountMinor: 0,
        tenders: [{ method: "cash", tenderedMinor: 500, changeMinor: 300 }],
      },
    },
    authenticity,
    hash,
  );
  return {
    opening,
    sale,
    draft: {
      id: ids.draft,
      businessId: ids.business,
      shiftId: ids.shift,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.hash,
      kind: "cart",
      revision: 1,
      data: { lines: [line], text: "unsent cart input" },
    },
  };
}
export async function openRepository(
  path: string,
  options: {
    fault?: FaultHook;
    authority?: StorageAuthority;
    readOnly?: boolean;
  } = {},
) {
  const raw = new NodeRaw(path, options.readOnly);
  const connection = await LocalSqliteConnection.open(raw);
  const repository = new LedgerRepository(connection, {
    authority: options.authority ?? fixtureAuthority(),
    hash,
    now: () => "2026-09-07T12:01:00.000Z",
    fault: options.fault,
  });
  await repository.initialize();
  return { raw, connection, repository };
}
export function remoteReceipt(
  operation: V2Operation,
  destination: "peer" | "cloud",
): V2Receipt {
  return {
    schemaVersion: 2,
    operationId: operation.operationId,
    businessId: operation.businessId,
    shiftId: operation.shiftId,
    authorityEpoch: operation.authorityEpoch,
    installationId: operation.installationId,
    snapshotId: operation.snapshotId,
    snapshotHash: operation.snapshotHash,
    sequence: operation.sequence,
    canonicalDigest: operation.canonicalDigest,
    destination,
    receivedAt: "2026-09-07T12:02:00.000Z",
    outcome: "committed",
  };
}
