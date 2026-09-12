import { describe, expect, it } from "vitest";
import {
  byteLength,
  canonical,
  decode,
  encode,
  makeEnvelope,
  MAX_WIRE_BYTES,
} from "../../src/ep02/protocol";
import { cashier, hash, prep } from "./fixtures";

async function original() {
  return makeEnvelope(
    cashier,
    { messageId: "independent-1", sequence: 1, number: 1, text: "fixture" },
    hash,
  );
}
async function signedPatch(patch: Record<string, unknown>): Promise<string> {
  const unsigned: Record<string, unknown> = { ...(await original()), ...patch };
  delete unsigned.digest;
  return JSON.stringify({
    ...unsigned,
    digest: await hash(canonical(unsigned)),
  });
}

describe("EP02-T04 independent protocol rejection and canonical evidence", () => {
  it("round-trips independently SHA256-signed data and ignores JSON key ordering", async () => {
    const packet = await original();
    const reversed = Object.fromEntries(Object.entries(packet).reverse());
    expect(await decode(JSON.stringify(reversed), prep, hash)).toEqual(packet);
  });

  it.each([
    "businessId",
    "shiftId",
    "snapshotId",
    "snapshotHash",
    "authorityEpoch",
    "pairingId",
    "senderDeviceId",
    "recipientDeviceId",
  ])("rejects re-signed wrong scope: %s", async (field) => {
    const value =
      field === "authorityEpoch"
        ? 2
        : field === "snapshotHash"
          ? "b".repeat(64)
          : "foreign";
    await expect(
      decode(await signedPatch({ [field]: value }), prep, hash),
    ).rejects.toThrow("wrong-scope");
  });

  it.each([
    "",
    "{",
    "null",
    "[]",
    "true",
    "23",
    '"text"',
    '{"__proto__":{"type":"data"}}',
  ])("rejects malformed root %j", async (value) => {
    await expect(decode(value, prep, hash)).rejects.toThrow("malformed");
  });

  it.each([
    { sequence: 0 },
    { sequence: -1 },
    { sequence: 1.5 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 },
    { number: 0 },
    { number: -1 },
    { number: 1.5 },
    { text: [] },
    { text: "a".repeat(2049) },
    { version: 2 },
    { messageId: "../inbox" },
    { messageId: "" },
    { extra: "unrecognized" },
    { tenderMinor: 500 },
    { ownerPrivateKey: "fixture-only-never-a-real-key" },
  ])("rejects invalid or extra fields %j", async (patch) => {
    await expect(decode(await signedPatch(patch), prep, hash)).rejects.toThrow(
      "malformed",
    );
  });

  it("rejects an unrecognized financial packet and the other role's command", async () => {
    await expect(
      decode(await signedPatch({ kind: "sale" }), prep, hash),
    ).rejects.toThrow("wrong-role");
    await expect(
      decode(await signedPatch({ kind: "test.prep-command" }), prep, hash),
    ).rejects.toThrow("wrong-role");
  });

  it("rejects changed content with unchanged digest", async () => {
    await expect(
      decode(
        JSON.stringify({ ...(await original()), text: "tampered" }),
        prep,
        hash,
      ),
    ).rejects.toThrow("digest-mismatch");
  });

  it("enforces wire size in UTF-8 bytes before parsing or hashing", async () => {
    const packet = await original();
    const multibyte = "💰".repeat(Math.floor(MAX_WIRE_BYTES / 4) + 1);
    expect(multibyte.length).toBeLessThan(MAX_WIRE_BYTES);
    expect(byteLength(multibyte)).toBeGreaterThan(MAX_WIRE_BYTES);
    let hashCalled = false;
    await expect(
      decode(multibyte, prep, async () => {
        hashCalled = true;
        return "a".repeat(64);
      }),
    ).rejects.toThrow("oversized");
    expect(hashCalled).toBe(false);
    expect(() => encode({ ...packet, text: multibyte })).toThrow("oversized");
  });

  it("does not permit surplus financial values in the fixture payload", async () => {
    const raw = await signedPatch({
      text: { display: "order", totalMinor: 10000 },
    });
    await expect(decode(raw, prep, hash)).rejects.toThrow("malformed");
  });
});
