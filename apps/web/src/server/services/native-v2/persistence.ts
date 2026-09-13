import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { v2Authorities, v2IngestIncidents, shifts } from "@miniros/db/schema";
import {
  v2IdSchema,
  v2DigestSchema,
  canonicalV2,
  utf8Length,
  V2_MAX_BYTES,
  type V2Operation,
  type V2PrepCommand,
} from "@miniros/domain/v2";
import type { NativeIdentity } from "./auth";
import { NativeAccessError } from "./auth";
import type { NativeFailure, NativeTransaction } from "./types";
import { nativeHash } from "./crypto";

export async function lockNativeShift(
  tx: NativeTransaction,
  businessId: string,
  shiftId: string,
) {
  const [shift] = await tx
    .select()
    .from(shifts)
    .where(and(eq(shifts.businessId, businessId), eq(shifts.id, shiftId)))
    .for("update")
    .limit(1);
  if (!shift || shift.deletedAt) throw new NativeAccessError();
  return shift;
}
export async function lockNativeAuthority(
  tx: NativeTransaction,
  businessId: string,
  shiftId: string,
) {
  const [authority] = await tx
    .select()
    .from(v2Authorities)
    .where(
      and(
        eq(v2Authorities.businessId, businessId),
        eq(v2Authorities.shiftId, shiftId),
      ),
    )
    .for("update")
    .limit(1);
  if (!authority)
    throw new NativeAccessError(
      "AUTHORITY",
      "This shift has no native authority.",
    );
  return authority;
}
export async function nativeIncident(
  tx: NativeTransaction,
  identity: NativeIdentity,
  scope: { businessId: string; shiftId: string },
  raw: unknown,
  code: string,
  now: Date,
  verifiedShape?: V2Operation | V2PrepCommand,
  expectedSequence?: number,
): Promise<NativeFailure> {
  const candidate =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const idValue = (key: string) =>
    v2IdSchema.safeParse(candidate[key]).success
      ? (candidate[key] as string)
      : null;
  const integerValue = (key: string) =>
    typeof candidate[key] === "number" &&
    Number.isSafeInteger(candidate[key]) &&
    (candidate[key] as number) > 0
      ? (candidate[key] as number)
      : null;
  const evidenceId = randomUUID();
  // Unknown JSON may contain secrets in unexpected fields: retain IDs plus content
  // fingerprint; only strictly parsed signed contracts are copied in full.
  let rawDigest: string | null = null;
  try {
    rawDigest = await nativeHash(canonicalV2(raw));
  } catch {
    /* Invalid non-JSON candidate. */
  }
  await tx.insert(v2IngestIncidents).values({
    id: evidenceId,
    ...scope,
    submittedBy: identity.userId,
    operationId: idValue("operationId"),
    commandId: idValue("commandId"),
    authorityEpoch: integerValue("authorityEpoch"),
    sequence: integerValue("sequence"),
    canonicalDigest: v2DigestSchema.safeParse(candidate.canonicalDigest).success
      ? (candidate.canonicalDigest as string)
      : null,
    category: code,
    evidence:
      verifiedShape && utf8Length(canonicalV2(verifiedShape)) <= V2_MAX_BYTES
        ? { envelope: verifiedShape }
        : { rawDigest, unsupportedOrInvalid: true },
    receivedAt: now,
  });
  return {
    ok: false,
    code,
    error:
      "This operation remains preserved for reconciliation; no business effect was applied.",
    evidenceId,
    ...(expectedSequence === undefined ? {} : { expectedSequence }),
  };
}
