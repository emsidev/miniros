import { randomUUID } from "node:crypto";
import type { Database } from "@miniros/db";
import { and, eq } from "drizzle-orm";
import { v2RecoveryImports } from "@miniros/db/schema";
import { canonicalV2, utf8Length, V2_MAX_BYTES } from "@miniros/domain/v2";
import { insertAuditLog } from "../operational-helpers";
import { NativeAccessError, type NativeIdentity } from "./auth";
import { requireNativeMember } from "./access";
import { nativeRecoveryRequestSchema } from "./schemas";
import { nativeHash } from "./crypto";
import { ingestNativeInTransaction } from "./ingestion";
import {
  lockNativeAuthority,
  lockNativeShift,
  nativeIncident,
} from "./persistence";
import type { NativeIngestReply, NativeOptions } from "./types";

export function createNativeRecovery(
  database: Database,
  now: () => Date,
  options: NativeOptions,
) {
  return async (identity: NativeIdentity, raw: unknown) => {
    const input = nativeRecoveryRequestSchema.parse(raw);
    if (utf8Length(canonicalV2(input)) > V2_MAX_BYTES)
      throw new NativeAccessError("OVERSIZED");
    return database.transaction(async (tx) => {
      await requireNativeMember(tx, identity, input.businessId, true);
      await lockNativeShift(tx, input.businessId, input.shiftId);
      const authority = await lockNativeAuthority(
        tx,
        input.businessId,
        input.shiftId,
      );
      const at = now();
      const { packageDigest, reason, ...packageBody } = input;
      if ((await nativeHash(canonicalV2(packageBody))) !== packageDigest)
        return nativeIncident(tx, identity, input, raw, "PACKAGE_DIGEST", at);
      const [original] = await tx
        .select()
        .from(v2RecoveryImports)
        .where(
          and(
            eq(v2RecoveryImports.businessId, input.businessId),
            eq(v2RecoveryImports.packageId, input.packageId),
          ),
        )
        .limit(1);
      if (original) {
        if (
          original.packageDigest !== packageDigest ||
          original.shiftId !== input.shiftId
        )
          return nativeIncident(
            tx,
            identity,
            input,
            raw,
            "PACKAGE_CONFLICT",
            at,
          );
        return original.result;
      }
      if (
        input.operations.some(
          (operation) =>
            operation.businessId !== input.businessId ||
            operation.shiftId !== input.shiftId ||
            operation.authorityEpoch !== authority.authorityEpoch,
        )
      ) {
        return nativeIncident(tx, identity, input, raw, "PACKAGE_SCOPE", at);
      }
      const replies: NativeIngestReply[] = [];
      // Owner authorization allows carrying original signed evidence. It does
      // not waive grants, identity signatures, ordering, or closed-state rules.
      for (const operation of input.operations)
        replies.push(
          await ingestNativeInTransaction(
            tx,
            identity,
            operation,
            at,
            options,
            true,
          ),
        );
      const result = {
        ok: true as const,
        packageId: input.packageId,
        replies,
        receivedAt: at.toISOString(),
      };
      const successfulClose = input.operations.find(
        (operation, index) =>
          operation.kind === "CLOSE_SHIFT" && replies[index]?.ok,
      );
      await tx.insert(v2RecoveryImports).values({
        id: randomUUID(),
        businessId: input.businessId,
        shiftId: input.shiftId,
        packageId: input.packageId,
        packageDigest,
        importedBy: identity.userId,
        authorizedBy: identity.userId,
        authorizationReason: reason,
        sourceAuthorityEpoch: authority.authorityEpoch,
        manifestId:
          successfulClose?.kind === "CLOSE_SHIFT"
            ? successfulClose.payload.manifestId
            : null,
        result,
        receivedAt: at,
      });
      await insertAuditLog(
        tx,
        {
          business: { id: input.businessId },
          user: { id: identity.userId },
          employee: null,
        },
        {
          action: "native_v2.recovery_import",
          entityType: "v2_recovery_import",
          entityId: input.packageId,
          shiftId: input.shiftId,
          metadata: {
            reason,
            packageDigest,
            accepted: replies.filter((reply) => reply.ok).length,
            rejected: replies.filter((reply) => !reply.ok).length,
          },
        },
      );
      return result;
    });
  };
}
