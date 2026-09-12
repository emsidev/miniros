import { createHash } from "node:crypto";
import {
  createV2Snapshot,
  sealV2Operation,
  v2Kinds,
  type V2Actor,
  type V2Draft,
  type V2Kind,
  type V2Operation,
  type V2OperationBody,
  type V2Payloads,
  type V2Receipt,
} from "@miniros/domain/v2";
import type {
  StorageAuthority,
  StorageIdentity,
} from "../../src/storage/v2/types";

export const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
export const hash = async (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const at = "2026-09-07T00:00:00.000Z";
export async function fixture(businessId = id(1), shiftId = id(2)) {
  const snapshot = await createV2Snapshot(
    {
      schemaVersion: 2,
      id: id(3),
      businessId,
      shiftId,
      version: 1,
      catalogVersion: "catalog-review",
      recipeVersion: "recipe-review",
      costingVersion: "cost-review",
      checklist: { id: id(4), version: 1, entries: [] },
      items: [
        {
          id: id(5),
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
        { id: id(6), ingredients: [{ kind: "item", itemId: id(5), atoms: 1 }] },
      ],
      products: [
        {
          id: id(7),
          name: "Review tea",
          priceMinor: 500,
          costMinor: 20,
          recipeId: id(6),
          modifierIds: [],
        },
      ],
      modifiers: [],
    },
    hash,
  );
  const actor: V2Actor = {
    businessId,
    shiftId,
    installationId: id(8),
    cashierInstallationId: id(8),
    authorityEpoch: 1,
    role: "cashier",
    allowedKinds: v2Kinds,
  };
  let identity: StorageIdentity | null = {
    accountId: id(9),
    businessId,
    installationId: id(8),
    locked: false,
  };
  let receiptsAllowed = true;
  const authority: StorageAuthority = {
    currentIdentity: () => identity,
    authorizeSnapshot: async () => actor,
    authorizeOperation: async () => actor,
    authorizeReceipt: async () => {
      if (!receiptsAllowed) throw new Error("UNAUTHENTICATED_RECEIPT");
    },
  };
  async function operation<K extends V2Kind>(
    kind: K,
    payload: V2Payloads[K],
    sequence: number,
    operationId = id(100 + sequence),
  ): Promise<V2Operation> {
    return sealV2Operation(
      {
        protocolVersion: 2,
        schemaVersion: 2,
        operationId,
        businessId,
        shiftId,
        snapshotId: snapshot.id,
        snapshotHash: snapshot.hash,
        installationId: actor.installationId,
        authorityEpoch: 1,
        sequence,
        occurredAt: at,
        kind,
        payload,
      } as V2OperationBody,
      {
        scheme: "ed25519",
        grantId: id(10),
        signature: Buffer.alloc(64).toString("base64"),
      },
      hash,
    );
  }
  const lines = [{ productId: id(7), quantity: 1, modifierIds: [] }];
  const opening = await operation(
    "OPEN_SHIFT",
    {
      counts: [{ itemId: id(5), kind: "counted", atoms: 10 }],
      openingCashMinor: 1000,
      reviewed: true,
    },
    1,
  );
  const sale = await operation(
    "SALE",
    {
      saleId: id(11),
      lines,
      discountMinor: 0,
      tenders: [{ method: "cash", tenderedMinor: 1000, changeMinor: 500 }],
    },
    2,
  );
  const draft: V2Draft = {
    id: id(12),
    businessId,
    shiftId,
    snapshotId: snapshot.id,
    snapshotHash: snapshot.hash,
    kind: "cart",
    revision: 1,
    data: { lines },
  };
  const receipt = (
    op: V2Operation,
    destination: "peer" | "cloud" = "cloud",
  ): V2Receipt => ({
    schemaVersion: 2,
    operationId: op.operationId,
    businessId,
    shiftId,
    authorityEpoch: 1,
    installationId: op.installationId,
    snapshotId: snapshot.id,
    snapshotHash: snapshot.hash,
    sequence: op.sequence,
    canonicalDigest: op.canonicalDigest,
    destination,
    receivedAt: at,
    outcome: "committed",
  });
  return {
    snapshot,
    actor,
    authority,
    opening,
    sale,
    draft,
    operation,
    receipt,
    scope: { shiftId, authorityEpoch: 1 },
    setIdentity: (value: StorageIdentity | null) => {
      identity = value;
    },
    setReceiptsAllowed: (value: boolean) => {
      receiptsAllowed = value;
    },
  };
}
