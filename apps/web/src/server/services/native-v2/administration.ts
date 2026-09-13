import { randomUUID } from "node:crypto";
import type { Database } from "@miniros/db";
import {
  v2Authorities,
  v2Snapshots,
  v2DeviceGrants,
  offlineShiftSessions,
  shifts,
} from "@miniros/db/schema";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import {
  canonicalV2,
  initialV2Projection,
  verifyV2Snapshot,
  v2Kinds,
} from "@miniros/domain/v2";
import { insertAuditLog } from "../operational-helpers";
import { NativeAccessError, type NativeIdentity } from "./auth";
import { requireNativeMember, requireNativeAssignment } from "./access";
import {
  nativeGrantRequestSchema,
  nativeRevokeRequestSchema,
  nativeSnapshotRequestSchema,
} from "./schemas";
import { nativeHash, normalizeGrantSpki } from "./crypto";
import { lockNativeAuthority, lockNativeShift } from "./persistence";

export const nativeCashierKinds = v2Kinds.filter(
  (kind) => kind !== "ADJUST_STOCK",
);
export function createNativeAdministration(
  database: Database,
  now: () => Date,
) {
  return {
    async registerSnapshot(identity: NativeIdentity, raw: unknown) {
      const input = nativeSnapshotRequestSchema.parse(raw);
      const snapshot = await verifyV2Snapshot(input.snapshot, nativeHash);
      return database.transaction(async (tx) => {
        await requireNativeMember(tx, identity, snapshot.businessId, true);
        const shift = await lockNativeShift(
          tx,
          snapshot.businessId,
          snapshot.shiftId,
        );
        const [existing] = await tx
          .select()
          .from(v2Authorities)
          .where(
            and(
              eq(v2Authorities.businessId, snapshot.businessId),
              eq(v2Authorities.shiftId, snapshot.shiftId),
            ),
          )
          .limit(1);
        if (existing) {
          const [original] = await tx
            .select()
            .from(v2Snapshots)
            .where(
              and(
                eq(v2Snapshots.businessId, snapshot.businessId),
                eq(v2Snapshots.id, existing.snapshotId),
              ),
            )
            .limit(1);
          if (
            existing.cashierInstallationId !== input.cashierInstallationId ||
            !original ||
            canonicalV2(original.snapshot) !== canonicalV2(snapshot)
          )
            throw new NativeAccessError(
              "CONFLICT",
              "The original authority and snapshot are immutable.",
            );
          return {
            authorityId: existing.id,
            authorityEpoch: existing.authorityEpoch,
            snapshot: original.snapshot,
          };
        }
        if (process.env.MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED !== "1") {
          throw new NativeAccessError(
            "ROLLOUT_DISABLED",
            "New native shifts are not enabled on this server.",
          );
        }
        if (shift.status !== "scheduled")
          throw new NativeAccessError(
            "SHIFT_STATE",
            "Prepare a scheduled shift before native operation.",
          );
        const [legacy] = await tx
          .select({ id: offlineShiftSessions.id })
          .from(offlineShiftSessions)
          .where(
            and(
              eq(offlineShiftSessions.businessId, snapshot.businessId),
              eq(offlineShiftSessions.shiftId, snapshot.shiftId),
              notInArray(offlineShiftSessions.status, ["closed", "released"]),
            ),
          )
          .limit(1);
        if (legacy)
          throw new NativeAccessError(
            "LEGACY_RESERVED",
            "Reconcile the existing prepared device first.",
          );
        const at = now();
        await tx.insert(v2Snapshots).values({
          id: snapshot.id,
          businessId: snapshot.businessId,
          shiftId: snapshot.shiftId,
          version: snapshot.version,
          catalogVersion: snapshot.catalogVersion,
          recipeVersion: snapshot.recipeVersion,
          costingVersion: snapshot.costingVersion,
          checklistId: snapshot.checklist.id,
          checklistVersion: snapshot.checklist.version,
          hash: snapshot.hash,
          snapshot,
          createdBy: identity.userId,
          createdAt: at,
        });
        const authorityId = randomUUID(),
          authorityEpoch = 1;
        const projection = initialV2Projection(snapshot, {
          businessId: snapshot.businessId,
          shiftId: snapshot.shiftId,
          installationId: input.cashierInstallationId,
          cashierInstallationId: input.cashierInstallationId,
          authorityEpoch,
          role: "cashier",
          allowedKinds: nativeCashierKinds,
        });
        await tx.insert(v2Authorities).values({
          id: authorityId,
          businessId: snapshot.businessId,
          shiftId: snapshot.shiftId,
          snapshotId: snapshot.id,
          snapshotHash: snapshot.hash,
          cashierInstallationId: input.cashierInstallationId,
          authorityEpoch,
          projection,
          createdAt: at,
          updatedAt: at,
        });
        // A legacy preparation can already hold a REPEATABLE READ snapshot
        // while waiting on this row. Create a new row version so that waiter
        // receives serialization failure instead of claiming from a stale view.
        await tx
          .update(shifts)
          .set({ updatedAt: at })
          .where(
            and(
              eq(shifts.businessId, snapshot.businessId),
              eq(shifts.id, snapshot.shiftId),
            ),
          );
        await insertAuditLog(
          tx,
          {
            business: { id: snapshot.businessId },
            user: { id: identity.userId },
            employee: null,
          },
          {
            action: "native_v2.authority_created",
            entityType: "v2_authority",
            entityId: authorityId,
            shiftId: snapshot.shiftId,
            metadata: { snapshotId: snapshot.id, snapshotHash: snapshot.hash },
          },
        );
        return { authorityId, authorityEpoch, snapshot };
      });
    },
    async issueGrant(identity: NativeIdentity, raw: unknown) {
      const input = nativeGrantRequestSchema.parse(raw);
      const grantSpki = normalizeGrantSpki(input.grantSpki);
      return database.transaction(async (tx) => {
        await requireNativeMember(tx, identity, input.businessId, true);
        await lockNativeShift(tx, input.businessId, input.shiftId);
        const authority = await lockNativeAuthority(
          tx,
          input.businessId,
          input.shiftId,
        );
        if (
          authority.state === "closed" ||
          (input.role === "cashier"
            ? input.installationId !== authority.cashierInstallationId
            : input.installationId === authority.cashierInstallationId)
        )
          throw new NativeAccessError("AUTHORITY");
        const assignment = await requireNativeAssignment(
          tx,
          input.businessId,
          input.shiftId,
          input.userId,
          input.role,
        );
        const priorGrants = await tx
          .select()
          .from(v2DeviceGrants)
          .where(
            and(
              eq(v2DeviceGrants.businessId, input.businessId),
              eq(v2DeviceGrants.shiftId, input.shiftId),
              eq(v2DeviceGrants.installationId, input.installationId),
              eq(v2DeviceGrants.authorityEpoch, authority.authorityEpoch),
            ),
          );
        if (
          priorGrants.some(
            (prior) =>
              prior.userId !== input.userId ||
              prior.grantSpki !== grantSpki ||
              prior.role !== input.role,
          )
        ) {
          throw new NativeAccessError(
            "INSTALLATION_IDENTITY",
            "An installation's identity and key cannot change within its authority epoch.",
          );
        }
        const [existing] = await tx
          .select()
          .from(v2DeviceGrants)
          .where(
            and(
              eq(v2DeviceGrants.businessId, input.businessId),
              eq(v2DeviceGrants.shiftId, input.shiftId),
              eq(v2DeviceGrants.installationId, input.installationId),
              eq(v2DeviceGrants.role, input.role),
              isNull(v2DeviceGrants.revokedAt),
            ),
          )
          .limit(1);
        if (existing) {
          if (
            existing.userId !== input.userId ||
            existing.grantSpki !== grantSpki ||
            existing.expiresAt <= now()
          )
            throw new NativeAccessError(
              "CONFLICT",
              "Explicitly revoke the existing installation grant before replacement.",
            );
          return existing;
        }
        const issuedAt = now();
        const [grant] = await tx
          .insert(v2DeviceGrants)
          .values({
            id: randomUUID(),
            businessId: input.businessId,
            shiftId: input.shiftId,
            authorityId: authority.id,
            userId: input.userId,
            employeeId: assignment.employeeId,
            assignmentId: assignment.assignmentId,
            installationId: input.installationId,
            authorityEpoch: authority.authorityEpoch,
            snapshotId: authority.snapshotId,
            snapshotHash: authority.snapshotHash,
            role: input.role,
            allowedKinds: input.role === "cashier" ? nativeCashierKinds : [],
            grantSpki,
            issuedBy: identity.userId,
            issuedAt,
            expiresAt: new Date(issuedAt.getTime() + input.ttlSeconds * 1000),
          })
          .returning();
        await insertAuditLog(
          tx,
          {
            business: { id: input.businessId },
            user: { id: identity.userId },
            employee: null,
          },
          {
            action: "native_v2.grant_issued",
            entityType: "v2_device_grant",
            entityId: grant!.id,
            shiftId: input.shiftId,
            metadata: {
              installationId: input.installationId,
              role: input.role,
              expiresAt: grant!.expiresAt.toISOString(),
            },
          },
        );
        return grant!;
      });
    },
    async revokeGrant(identity: NativeIdentity, raw: unknown) {
      const input = nativeRevokeRequestSchema.parse(raw);
      return database.transaction(async (tx) => {
        await requireNativeMember(tx, identity, input.businessId, true);
        await lockNativeShift(tx, input.businessId, input.shiftId);
        const [grant] = await tx
          .select()
          .from(v2DeviceGrants)
          .where(
            and(
              eq(v2DeviceGrants.businessId, input.businessId),
              eq(v2DeviceGrants.shiftId, input.shiftId),
              eq(v2DeviceGrants.id, input.grantId),
            ),
          )
          .for("update")
          .limit(1);
        if (!grant) throw new NativeAccessError();
        if (grant.revokedAt)
          return {
            grantId: grant.id,
            revokedAt: grant.revokedAt.toISOString(),
          };
        const revokedAt = now();
        await tx
          .update(v2DeviceGrants)
          .set({
            revokedAt,
            revokedBy: identity.userId,
            revocationReason: input.reason,
          })
          .where(eq(v2DeviceGrants.id, grant.id));
        await insertAuditLog(
          tx,
          {
            business: { id: input.businessId },
            user: { id: identity.userId },
            employee: null,
          },
          {
            action: "native_v2.grant_revoked",
            entityType: "v2_device_grant",
            entityId: grant.id,
            shiftId: input.shiftId,
            metadata: { reason: input.reason },
          },
        );
        return { grantId: grant.id, revokedAt: revokedAt.toISOString() };
      });
    },
  };
}
