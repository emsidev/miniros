/** EP02 numbered-fixture protocol. This is deliberately NOT the financial journal. */
export const MAX_WIRE_BYTES = 16_384;
export const MAX_REORDER_WINDOW = 256;
export const MAX_STORED_MESSAGES = 10_000;
export type Role = "cashier" | "prep";
export interface PeerScope {
  businessId: string;
  shiftId: string;
  snapshotId: string;
  snapshotHash: string;
  authorityEpoch: number;
  pairingId: string;
  localDeviceId: string;
  peerDeviceId: string;
  role: Role;
}
export interface WireScope {
  businessId: string;
  shiftId: string;
  snapshotId: string;
  snapshotHash: string;
  authorityEpoch: number;
  pairingId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
}
export interface TestEnvelope extends WireScope {
  version: 1;
  type: "data";
  messageId: string;
  sequence: number;
  kind: "test.order" | "test.prep-command";
  number: number;
  text: string;
  digest: string;
}
export interface DurableReceipt extends WireScope {
  version: 1;
  type: "receipt";
  messageId: string;
  sequence: number;
  digest: string;
  storedAt: string;
}
export type PeerPacket = TestEnvelope | DurableReceipt;
export type Hash = (canonical: string) => Promise<string>;
export class ProtocolError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ProtocolError";
  }
}
const identifiers = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const scopeKeys = [
  "businessId",
  "shiftId",
  "snapshotId",
  "snapshotHash",
  "authorityEpoch",
  "pairingId",
  "senderDeviceId",
  "recipientDeviceId",
];
export function canonical(value: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, value[key]]),
    ),
  );
}
export function byteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < text.length &&
      text.charCodeAt(index + 1) >= 0xdc00 &&
      text.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index++;
    } else bytes += 3;
  }
  return bytes;
}
export function scopeKey(scope: PeerScope): string {
  validateScope(scope);
  return canonical({ ...scope });
}
export function validateScope(scope: PeerScope): void {
  for (const key of [
    "businessId",
    "shiftId",
    "snapshotId",
    "pairingId",
    "localDeviceId",
    "peerDeviceId",
  ] as const) {
    if (!identifiers.test(scope[key])) throw new ProtocolError("invalid-scope");
  }
  if (
    !hashPattern.test(scope.snapshotHash) ||
    !Number.isSafeInteger(scope.authorityEpoch) ||
    scope.authorityEpoch < 1 ||
    scope.localDeviceId === scope.peerDeviceId ||
    !["cashier", "prep"].includes(scope.role)
  )
    throw new ProtocolError("invalid-scope");
}
export function wireScope(scope: PeerScope): WireScope {
  validateScope(scope);
  const {
    businessId,
    shiftId,
    snapshotId,
    snapshotHash,
    authorityEpoch,
    pairingId,
    localDeviceId,
    peerDeviceId,
  } = scope;
  return {
    businessId,
    shiftId,
    snapshotId,
    snapshotHash,
    authorityEpoch,
    pairingId,
    senderDeviceId: localDeviceId,
    recipientDeviceId: peerDeviceId,
  };
}
export function assertIncomingScope(value: WireScope, scope: PeerScope): void {
  const expected = {
    ...wireScope(scope),
    senderDeviceId: scope.peerDeviceId,
    recipientDeviceId: scope.localDeviceId,
  };
  if (
    scopeKeys.some(
      (key) =>
        value[key as keyof WireScope] !== expected[key as keyof WireScope],
    )
  )
    throw new ProtocolError("wrong-scope");
}
export function encode(packet: PeerPacket): string {
  const raw = canonical({ ...packet });
  if (byteLength(raw) > MAX_WIRE_BYTES) throw new ProtocolError("oversized");
  return raw;
}
export async function makeEnvelope(
  scope: PeerScope,
  input: { messageId: string; sequence: number; number: number; text: string },
  hash: Hash,
): Promise<TestEnvelope> {
  const unsigned = {
    ...wireScope(scope),
    version: 1 as const,
    type: "data" as const,
    ...input,
    kind:
      scope.role === "cashier"
        ? ("test.order" as const)
        : ("test.prep-command" as const),
  };
  const result = { ...unsigned, digest: await hash(canonical(unsigned)) };
  const receiver = {
    ...scope,
    role: scope.role === "cashier" ? ("prep" as const) : ("cashier" as const),
    localDeviceId: scope.peerDeviceId,
    peerDeviceId: scope.localDeviceId,
  };
  await decode(encode(result), receiver, hash);
  return result;
}
export async function decode(
  raw: string,
  scope: PeerScope,
  hash: Hash,
): Promise<PeerPacket> {
  if (typeof raw !== "string" || byteLength(raw) > MAX_WIRE_BYTES)
    throw new ProtocolError("oversized");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ProtocolError("malformed");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ProtocolError("malformed");
  const p = value as Record<string, unknown>;
  const keys = [
    ...scopeKeys,
    "version",
    "type",
    "messageId",
    "sequence",
    "digest",
    ...(p.type === "data" ? ["kind", "number", "text"] : ["storedAt"]),
  ];
  if (
    Object.keys(p).length !== keys.length ||
    keys.some((key) => !(key in p)) ||
    p.version !== 1 ||
    !["data", "receipt"].includes(p.type as string)
  )
    throw new ProtocolError("malformed");
  if (
    typeof p.messageId !== "string" ||
    !identifiers.test(p.messageId) ||
    typeof p.digest !== "string" ||
    !hashPattern.test(p.digest) ||
    !Number.isSafeInteger(p.sequence) ||
    Number(p.sequence) < 1
  )
    throw new ProtocolError("malformed");
  assertIncomingScope(p as unknown as WireScope, scope);
  if (p.type === "data") {
    if (p.kind !== (scope.role === "prep" ? "test.order" : "test.prep-command"))
      throw new ProtocolError("wrong-role");
    if (
      !Number.isSafeInteger(p.number) ||
      Number(p.number) < 1 ||
      typeof p.text !== "string" ||
      p.text.length > 2_048
    )
      throw new ProtocolError("malformed");
    const { digest, ...unsigned } = p;
    if ((await hash(canonical(unsigned))) !== digest)
      throw new ProtocolError("digest-mismatch");
  } else if (
    typeof p.storedAt !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.storedAt) ||
    !Number.isFinite(Date.parse(p.storedAt))
  )
    throw new ProtocolError("malformed");
  return p as unknown as PeerPacket;
}
