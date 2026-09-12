import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalV2,
  decodeV2Operation,
  sealV2Operation,
  sealV2PrepCommand,
  verifyV2Operation,
  verifyV2PrepCommand,
} from "../../domain/src/v2/core";
import {
  v2CountSchema,
  v2DraftSchema,
  v2IdSchema,
  v2OperationSchema,
  v2ReceiptSchema,
} from "../../domain/src/v2/schema";
import { V2_MAX_BYTES, type V2Hash } from "../../domain/src/v2/types";
import { OFFLINE_SCHEMA_VERSION, offlineEnvelopeSchema } from "../src/offline";

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
const hash: V2Hash = async (value) =>
  createHash("sha256").update(value).digest("hex");
const authenticity = {
  scheme: "ed25519" as const,
  grantId: uuid(10),
  signature: Buffer.alloc(64).toString("base64"),
};
const body = () => ({
  protocolVersion: 2,
  schemaVersion: 2,
  operationId: uuid(1),
  businessId: uuid(2),
  shiftId: uuid(3),
  snapshotId: uuid(4),
  snapshotHash: "a".repeat(64),
  installationId: uuid(5),
  authorityEpoch: 1,
  sequence: 1,
  occurredAt: "2026-09-07T00:00:00.000Z",
  kind: "CASH_ADJUSTMENT",
  payload: {
    direction: "in",
    amountMinor: 500,
    reason: "Independent fixture only",
  },
});

describe("EP03 independent v2 canonical schema and legacy boundary review", () => {
  it("preserves empty draft collections but rejects duplicate packing answers and committed empty openings", async () => {
    const draft = {
      id: uuid(50),
      businessId: uuid(2),
      shiftId: uuid(3),
      snapshotId: uuid(4),
      snapshotHash: "a".repeat(64),
      kind: "cart",
      revision: 1,
      data: { lines: [], counts: [], answers: [] },
    };
    expect(v2DraftSchema.parse(draft)).toEqual(draft);
    const answer = {
      entryId: uuid(51),
      templateVersion: 1,
      kind: "packed",
      actorId: uuid(5),
      at: "2026-09-07T00:00:00.000Z",
    };
    expect(
      v2DraftSchema.safeParse({
        ...draft,
        kind: "packing",
        data: { answers: [answer, answer] },
      }).success,
    ).toBe(false);
    expect(
      v2DraftSchema.safeParse({
        ...draft,
        kind: "opening",
        data: {
          counts: [
            { itemId: uuid(30), kind: "counted", atoms: 0 },
            { itemId: uuid(30), kind: "not-brought" },
          ],
        },
      }).success,
    ).toBe(false);
    await expect(
      sealV2Operation(
        {
          ...body(),
          kind: "OPEN_SHIFT",
          payload: { counts: [], openingCashMinor: 0, reviewed: true },
        },
        authenticity,
        hash,
      ),
    ).rejects.toThrow();
  });

  it("binds a signed prep command digest to its scope, sale and action without treating it as a journal operation", async () => {
    const input = {
      protocolVersion: 2,
      schemaVersion: 2,
      commandId: uuid(60),
      businessId: uuid(2),
      shiftId: uuid(3),
      snapshotId: uuid(4),
      snapshotHash: "a".repeat(64),
      installationId: uuid(7),
      authorityEpoch: 1,
      saleId: uuid(70),
      action: "making",
      occurredAt: "2026-09-07T00:00:00.000Z",
    };
    const command = await sealV2PrepCommand(input, authenticity, hash);
    expect(await verifyV2PrepCommand(command, hash)).toEqual(command);
    for (const patch of [
      { saleId: uuid(71) },
      { shiftId: uuid(72) },
      { action: "done" },
    ])
      await expect(
        verifyV2PrepCommand({ ...command, ...patch }, hash),
      ).rejects.toThrow("COMMAND_DIGEST");
    expect(v2OperationSchema.safeParse(command).success).toBe(false);
    await expect(
      sealV2PrepCommand(
        { ...input, action: "create-sale" },
        authenticity,
        hash,
      ),
    ).rejects.toThrow();
  });

  it("uses independently expected recursive canonical JSON, preserving array order", () => {
    expect(canonicalV2({ z: [3, 2, 1], b: { z: 0, a: "é" }, a: true })).toBe(
      '{"a":true,"b":{"a":"é","z":0},"z":[3,2,1]}',
    );
    expect(canonicalV2({ b: 1, a: 2 })).toBe(canonicalV2({ a: 2, b: 1 }));
  });

  it.each([
    undefined,
    NaN,
    Infinity,
    1.25,
    new Date(),
    new Map(),
    () => 1,
    [undefined],
    { a: undefined },
  ])("rejects noncanonical JSON value %#", (value) => {
    expect(() => canonicalV2(value)).toThrow();
  });

  it("rejects cyclic structures, sparse arrays and a bounded-depth violation", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => canonicalV2(cycle)).toThrow("CYCLIC_JSON");
    expect(() => canonicalV2(new Array(3))).toThrow("NON_JSON");
    let nested: unknown = {};
    for (let level = 0; level < 34; level++) nested = { nested };
    expect(() => canonicalV2(nested)).toThrow("TOO_DEEP");
  });

  it("matches an independently calculated digest and decodes arbitrarily ordered object keys", async () => {
    const input = body();
    const operation = await sealV2Operation(input, authenticity, hash);
    const expectedCanonical =
      '{"authorityEpoch":1,"businessId":"00000000-0000-4000-8000-000000000002","installationId":"00000000-0000-4000-8000-000000000005","kind":"CASH_ADJUSTMENT","occurredAt":"2026-09-07T00:00:00.000Z","operationId":"00000000-0000-4000-8000-000000000001","payload":{"amountMinor":500,"direction":"in","reason":"Independent fixture only"},"protocolVersion":2,"schemaVersion":2,"sequence":1,"shiftId":"00000000-0000-4000-8000-000000000003","snapshotHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","snapshotId":"00000000-0000-4000-8000-000000000004"}';
    expect(operation.canonicalDigest).toBe(await hash(expectedCanonical));
    const reverse = Object.fromEntries(Object.entries(operation).reverse());
    expect(await decodeV2Operation(JSON.stringify(reverse), hash)).toEqual(
      operation,
    );
  });

  it.each([
    { schemaVersion: 1 },
    { schemaVersion: 3 },
    { protocolVersion: 1 },
    { extra: "ignored?" },
    { sequence: 0 },
    { sequence: 1.5 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 },
    { authorityEpoch: 0 },
    { operationId: "constructor" },
    { operationId: "__proto__" },
    { businessId: "00000000-0000-4000-8000-00000000000A" },
    { occurredAt: "yesterday" },
    {
      payload: {
        direction: "in",
        amountMinor: 500,
        reason: "valid",
        serverRole: "owner",
      },
    },
    { payload: { direction: "in", amountMinor: -1, reason: "bad" } },
    { payload: { direction: "in", amountMinor: NaN, reason: "bad" } },
    { payload: { direction: "in", amountMinor: 1, reason: " " } },
  ])("rejects strict-schema violation %j", async (patch) => {
    await expect(
      sealV2Operation({ ...body(), ...patch }, authenticity, hash),
    ).rejects.toThrow();
  });

  it("rejects altered amount with the original digest and altered digest with the original body", async () => {
    const operation = await sealV2Operation(body(), authenticity, hash);
    await expect(
      verifyV2Operation(
        { ...operation, payload: { ...body().payload, amountMinor: 501 } },
        hash,
      ),
    ).rejects.toThrow("OPERATION_DIGEST");
    await expect(
      verifyV2Operation(
        { ...operation, canonicalDigest: "b".repeat(64) },
        hash,
      ),
    ).rejects.toThrow("OPERATION_DIGEST");
  });

  it("distinguishes structural signature metadata from actual cryptographic authorization", async () => {
    const operation = await sealV2Operation(body(), authenticity, hash);
    expect(await verifyV2Operation(operation, hash)).toEqual(operation);
    expect(
      v2OperationSchema.safeParse({
        ...operation,
        authenticity: { ...authenticity, signature: "short" },
      }).success,
    ).toBe(false);
    expect(
      v2OperationSchema.safeParse({
        ...operation,
        authenticity: { ...authenticity, scheme: "checksum" },
      }).success,
    ).toBe(false);
    // A syntactically valid all-zero signature is deliberately accepted structurally here.
    // EP05's authenticated adapter must verify the signature before creating trusted context.
    expect(operation.authenticity.signature).toBe(
      Buffer.alloc(64).toString("base64"),
    );
  });

  it("bounds raw UTF-8 input before parsing/hashing, including multibyte input shorter in JS characters", async () => {
    let called = false;
    const noHash: V2Hash = async () => {
      called = true;
      return "a".repeat(64);
    };
    const raw = "💰".repeat(V2_MAX_BYTES / 4 + 1);
    expect(raw.length).toBeLessThan(V2_MAX_BYTES);
    await expect(decodeV2Operation(raw, noHash)).rejects.toThrow("OVERSIZED");
    expect(called).toBe(false);
    await expect(decodeV2Operation("not JSON", hash)).rejects.toThrow(
      "MALFORMED",
    );
  });

  it("refuses to create a structurally valid close envelope beyond its advertised wire limit", async () => {
    const oversized = {
      ...body(),
      kind: "CLOSE_SHIFT",
      payload: {
        manifestId: uuid(20),
        lastFinancialSequence: 0,
        journalDigest: "b".repeat(64),
        expectedCashMinor: 0,
        netSalesMinor: 0,
        expectedStockAtoms: { [uuid(30)]: 0 },
        actualCashMinor: null,
        counts: [{ itemId: uuid(30), kind: "uncounted" }],
        pendingAttachmentIds: [],
        manualResolutions: Array.from({ length: 150 }, (_, index) => ({
          saleId: uuid(100 + index),
          reason: "x".repeat(2000),
        })),
      },
    };
    await expect(
      sealV2Operation(oversized, authenticity, hash),
    ).rejects.toThrow("OVERSIZED");
  });

  it("retains uncounted, counted zero and not-brought as three different strict states", () => {
    const parsed = [
      { itemId: uuid(30), kind: "uncounted" },
      { itemId: uuid(30), kind: "counted", atoms: 0 },
      { itemId: uuid(30), kind: "not-brought" },
    ].map((value) => v2CountSchema.parse(value));
    expect(parsed.map((value) => value.kind)).toEqual([
      "uncounted",
      "counted",
      "not-brought",
    ]);
    expect(
      v2CountSchema.safeParse({ itemId: uuid(30), kind: "uncounted", atoms: 0 })
        .success,
    ).toBe(false);
    expect(
      v2CountSchema.safeParse({ itemId: uuid(30), kind: "counted", atoms: -1 })
        .success,
    ).toBe(false);
  });

  it("requires canonical lowercase UUIDs and a scoped committed destination on receipts", async () => {
    expect(v2IdSchema.safeParse("constructor").success).toBe(false);
    const operation = await sealV2Operation(body(), authenticity, hash);
    const receipt = {
      schemaVersion: 2,
      operationId: operation.operationId,
      businessId: operation.businessId,
      shiftId: operation.shiftId,
      authorityEpoch: 1,
      installationId: operation.installationId,
      snapshotId: operation.snapshotId,
      snapshotHash: operation.snapshotHash,
      sequence: 1,
      canonicalDigest: operation.canonicalDigest,
      destination: "cloud",
      receivedAt: "2026-09-07T00:00:01.000Z",
      outcome: "committed",
    };
    expect(v2ReceiptSchema.parse(receipt)).toEqual(receipt);
    expect(
      v2ReceiptSchema.safeParse({ ...receipt, outcome: "sent" }).success,
    ).toBe(false);
    expect(
      v2ReceiptSchema.safeParse({ ...receipt, destination: "socket" }).success,
    ).toBe(false);
  });

  it("preserves supported version1 normalized quantity semantics and never silently upgrades that envelope", async () => {
    const legacy = {
      schemaVersion: 1,
      id: uuid(1),
      sessionId: uuid(2),
      snapshotId: uuid(3),
      sequence: 1,
      occurredAt: "2026-09-07T00:00:00.000Z",
      operation: {
        type: "START_SHIFT",
        payload: {
          shiftId: uuid(4),
          inventoryLocationId: uuid(5),
          openingEventId: uuid(6),
          counts: [{ inventoryItemId: uuid(7), quantity: "1.2346" }],
          notes: null,
        },
      },
    };
    expect(OFFLINE_SCHEMA_VERSION).toBe(1);
    const parsed = offlineEnvelopeSchema.parse(legacy);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.operation.type).toBe("START_SHIFT");
    if (parsed.operation.type === "START_SHIFT")
      expect(parsed.operation.payload.counts[0]!.quantity).toBe(1.235);
    await expect(
      decodeV2Operation(JSON.stringify(legacy), hash),
    ).rejects.toThrow();
    expect(
      offlineEnvelopeSchema.safeParse({ ...legacy, schemaVersion: 2 }).success,
    ).toBe(false);
  });
});
