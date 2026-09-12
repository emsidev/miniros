import { randomUUID } from "node:crypto";
import type { Database } from "@miniros/db";
import { and, eq } from "drizzle-orm";
import {
  v2Authorities,
  v2DeviceGrants,
  v2Operations,
  v2Snapshots,
  v2Effects,
  v2CountSeals,
  v2CloseManifests,
  v2PrepCommands,
} from "@miniros/db/schema";
import {
  applyV2Operation,
  canonicalV2,
  summaryV2,
  verifyV2Operation,
  verifyV2PrepCommand,
  verifyV2Snapshot,
  v2OperationSchema,
  v2PrepCommandSchema,
  V2Error,
  type V2Operation,
  type V2PrepCommand,
  type V2Projection,
  type V2Receipt,
  type V2Actor,
} from "@miniros/domain/v2";
import { NativeAccessError, type NativeIdentity } from "./auth";
import { requireNativeMember, requireNativeAssignment } from "./access";
import { nativeScopeSchema } from "./schemas";
import { nativeHash, verifyNativeSignature } from "./crypto";
import {
  lockNativeAuthority,
  lockNativeShift,
  nativeIncident,
} from "./persistence";
import type {
  NativeIngestReply,
  NativeOptions,
  NativePrepReceipt,
  NativeTransaction,
  NativeFailure,
} from "./types";

type Authority = typeof v2Authorities.$inferSelect;
type Grant = typeof v2DeviceGrants.$inferSelect;
export function nativeErrorCode(error: unknown): string | undefined {
  if (error instanceof V2Error || error instanceof NativeAccessError)
    return error.code;
  const candidate = error as { code?: string; cause?: { code?: string } };
  if ((candidate.code ?? candidate.cause?.code)?.startsWith("23"))
    return "CONFLICT";
  return undefined;
}
async function identifyGrant(
  tx: NativeTransaction,
  identity: NativeIdentity,
  candidate: V2Operation | V2PrepCommand,
  authority: Authority,
  recovery: boolean,
) {
  const [grant] = await tx
    .select()
    .from(v2DeviceGrants)
    .where(
      and(
        eq(v2DeviceGrants.businessId, candidate.businessId),
        eq(v2DeviceGrants.shiftId, candidate.shiftId),
        eq(v2DeviceGrants.id, candidate.authenticity.grantId),
      ),
    )
    .for("share")
    .limit(1);
  if (
    !grant ||
    (!recovery && grant.userId !== identity.userId) ||
    grant.installationId !== candidate.installationId ||
    grant.authorityEpoch !== candidate.authorityEpoch ||
    grant.snapshotId !== candidate.snapshotId ||
    grant.snapshotHash !== candidate.snapshotHash ||
    grant.authorityId !== authority.id ||
    authority.snapshotId !== candidate.snapshotId ||
    authority.snapshotHash !== candidate.snapshotHash ||
    authority.authorityEpoch !== candidate.authorityEpoch
  )
    throw new NativeAccessError("GRANT_SCOPE");
  verifyNativeSignature(
    candidate.canonicalDigest,
    candidate.authenticity.signature,
    grant.grantSpki,
  );
  return grant;
}
async function authorizeNew(
  tx: NativeTransaction,
  candidate: V2Operation | V2PrepCommand,
  grant: Grant,
  role: "cashier" | "prep",
  now: Date,
) {
  if (grant.revokedAt) throw new NativeAccessError("REVOKED");
  if (now < grant.issuedAt || now >= grant.expiresAt)
    throw new NativeAccessError("EXPIRED");
  if (grant.role !== role) throw new NativeAccessError("ROLE");
  const current = await requireNativeAssignment(
    tx,
    candidate.businessId,
    candidate.shiftId,
    grant.userId,
    role,
  );
  if (
    current.assignmentId !== grant.assignmentId ||
    current.employeeId !== grant.employeeId
  )
    throw new NativeAccessError("ASSIGNMENT");
}
async function verifiedPrep(
  tx: NativeTransaction,
  operation: V2Operation,
  authority: Authority,
): Promise<{
  actorEvidence: V2Actor["verifiedPrepCommands"];
  commandId?: string;
}> {
  if (
    operation.kind !== "PREP_TRANSITION" &&
    operation.kind !== "RETURN_UNPREPARED"
  )
    return { actorEvidence: [] };
  const commandId =
    operation.kind === "PREP_TRANSITION"
      ? operation.payload.commandId
      : operation.payload.prepCommandId;
  const action =
    operation.kind === "PREP_TRANSITION"
      ? operation.payload.next
      : "unprepared-return";
  const [row] = await tx
    .select()
    .from(v2PrepCommands)
    .where(
      and(
        eq(v2PrepCommands.businessId, operation.businessId),
        eq(v2PrepCommands.shiftId, operation.shiftId),
        eq(v2PrepCommands.id, commandId),
      ),
    )
    .for("update")
    .limit(1);
  if (
    !row ||
    row.appliedOperationId ||
    row.authorityId !== authority.id ||
    row.authorityEpoch !== operation.authorityEpoch ||
    row.snapshotId !== operation.snapshotId ||
    row.snapshotHash !== operation.snapshotHash ||
    row.saleId !== operation.payload.saleId ||
    row.action !== action ||
    (operation.kind === "PREP_TRANSITION" &&
      row.installationId !== operation.payload.prepInstallationId)
  )
    throw new NativeAccessError("PREP_EVIDENCE");
  // Storage holds an independently authenticated immutable command. Recheck its
  // persisted signature; later grant expiry does not erase historical evidence.
  const command = await verifyV2PrepCommand(row.command, nativeHash);
  const [grant] = await tx
    .select()
    .from(v2DeviceGrants)
    .where(
      and(
        eq(v2DeviceGrants.businessId, operation.businessId),
        eq(v2DeviceGrants.id, row.grantId),
      ),
    )
    .limit(1);
  if (
    !grant ||
    grant.role !== "prep" ||
    command.canonicalDigest !== row.canonicalDigest ||
    command.installationId !== row.installationId ||
    command.businessId !== row.businessId ||
    command.shiftId !== row.shiftId ||
    command.saleId !== row.saleId ||
    command.action !== row.action ||
    command.authenticity.grantId !== grant.id
  )
    throw new NativeAccessError("PREP_EVIDENCE");
  verifyNativeSignature(
    command.canonicalDigest,
    command.authenticity.signature,
    grant.grantSpki,
  );
  return {
    commandId,
    actorEvidence: [
      {
        commandId,
        saleId: row.saleId,
        prepInstallationId: row.installationId,
        action,
      },
    ],
  };
}
async function commitOperation(
  tx: NativeTransaction,
  authority: Authority,
  grant: Grant,
  operation: V2Operation,
  now: Date,
  options: NativeOptions,
): Promise<V2Receipt> {
  const [stored] = await tx
    .select()
    .from(v2Snapshots)
    .where(
      and(
        eq(v2Snapshots.businessId, operation.businessId),
        eq(v2Snapshots.id, authority.snapshotId),
      ),
    )
    .limit(1);
  if (!stored) throw new Error("Missing persisted snapshot.");
  const snapshot = await verifyV2Snapshot(stored.snapshot, nativeHash);
  const before = authority.projection as V2Projection;
  if (
    before.lastSequence !== authority.lastSequence ||
    before.state !== authority.state
  )
    throw new Error("Authority projection mismatch.");
  const prep = await verifiedPrep(tx, operation, authority);
  const actor: V2Actor = {
    businessId: operation.businessId,
    shiftId: operation.shiftId,
    installationId: grant.installationId,
    cashierInstallationId: authority.cashierInstallationId,
    authorityEpoch: authority.authorityEpoch,
    role: "cashier",
    allowedKinds: grant.allowedKinds as V2Actor["allowedKinds"],
    verifiedPrepCommands: prep.actorEvidence,
  };
  const after = await applyV2Operation(
    snapshot,
    before,
    operation,
    actor,
    nativeHash,
  );
  const oldSummary = summaryV2(before),
    newSummary = summaryV2(after);
  const receipt: V2Receipt = {
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
    destination: "cloud",
    receivedAt: now.toISOString(),
    outcome: "committed",
  };
  // The operation FK is deferred. This permits a real fault after effects but
  // before the original receipt; the enclosing transaction rolls both back.
  await tx.insert(v2Effects).values({
    id: randomUUID(),
    businessId: operation.businessId,
    shiftId: operation.shiftId,
    operationId: operation.operationId,
    sequence: operation.sequence,
    stockDeltaAtoms: Object.fromEntries(
      Object.keys(after.stockAtoms).map((id) => [
        id,
        after.stockAtoms[id]! - before.stockAtoms[id]!,
      ]),
    ),
    cashDeltaMinor: newSummary.expectedCashMinor - oldSummary.expectedCashMinor,
    grossSalesDeltaMinor: after.grossSalesMinor - before.grossSalesMinor,
    discountsDeltaMinor: after.discountsMinor - before.discountsMinor,
    refundsDeltaMinor: after.refundsMinor - before.refundsMinor,
    manualDigitalDeltaMinor:
      newSummary.netManualDigitalMinor - oldSummary.netManualDigitalMinor,
    createdAt: now,
  });
  await options.fault?.("after-effects", tx);
  await tx.insert(v2Operations).values({
    id: operation.operationId,
    businessId: operation.businessId,
    shiftId: operation.shiftId,
    authorityId: authority.id,
    authorityEpoch: operation.authorityEpoch,
    snapshotId: operation.snapshotId,
    snapshotHash: operation.snapshotHash,
    installationId: operation.installationId,
    grantId: grant.id,
    sequence: operation.sequence,
    kind: operation.kind,
    canonicalDigest: operation.canonicalDigest,
    envelope: operation,
    receipt,
    receivedAt: now,
  });
  if (operation.kind === "OPEN_SHIFT" || operation.kind === "CLOSE_SHIFT") {
    await tx.insert(v2CountSeals).values({
      id: randomUUID(),
      businessId: operation.businessId,
      shiftId: operation.shiftId,
      authorityEpoch: operation.authorityEpoch,
      snapshotId: operation.snapshotId,
      operationId: operation.operationId,
      sequence: operation.sequence,
      kind: operation.kind === "OPEN_SHIFT" ? "opening" : "closing",
      counts: operation.payload.counts,
      cashMinor:
        operation.kind === "OPEN_SHIFT"
          ? operation.payload.openingCashMinor
          : operation.payload.actualCashMinor,
      createdAt: now,
    });
  }
  if (operation.kind === "CLOSE_SHIFT")
    await tx.insert(v2CloseManifests).values({
      id: operation.payload.manifestId,
      businessId: operation.businessId,
      shiftId: operation.shiftId,
      authorityEpoch: operation.authorityEpoch,
      snapshotId: operation.snapshotId,
      operationId: operation.operationId,
      sequence: operation.sequence,
      lastFinancialSequence: operation.payload.lastFinancialSequence,
      journalDigest: operation.payload.journalDigest,
      manifest: operation.payload,
      receivedAt: now,
    });
  if (prep.commandId)
    await tx
      .update(v2PrepCommands)
      .set({ appliedOperationId: operation.operationId })
      .where(
        and(
          eq(v2PrepCommands.businessId, operation.businessId),
          eq(v2PrepCommands.id, prep.commandId),
        ),
      );
  await tx
    .update(v2Authorities)
    .set({
      projection: after,
      lastSequence: after.lastSequence,
      state: after.state,
      updatedAt: now,
    })
    .where(eq(v2Authorities.id, authority.id));
  return receipt;
}

/** One independent transaction per shift request. Recovery calls share its lock/transaction. */
export async function ingestNativeInTransaction(
  tx: NativeTransaction,
  identity: NativeIdentity,
  raw: unknown,
  now: Date,
  options: NativeOptions,
  recovery = false,
): Promise<NativeIngestReply> {
  const scope = nativeScopeSchema.parse(raw);
  await requireNativeMember(tx, identity, scope.businessId, recovery);
  await lockNativeShift(tx, scope.businessId, scope.shiftId);
  const authority = await lockNativeAuthority(
    tx,
    scope.businessId,
    scope.shiftId,
  );
  const parsed = v2OperationSchema.safeParse(raw);
  if (!parsed.success)
    return nativeIncident(
      tx,
      identity,
      scope,
      raw,
      "UNSUPPORTED_OR_INVALID",
      now,
    );
  const operation = parsed.data;
  try {
    const grant = await identifyGrant(
      tx,
      identity,
      operation,
      authority,
      recovery,
    );
    await verifyV2Operation(operation, nativeHash);
    const [previous] = await tx
      .select()
      .from(v2Operations)
      .where(
        and(
          eq(v2Operations.businessId, scope.businessId),
          eq(v2Operations.id, operation.operationId),
        ),
      )
      .limit(1);
    if (previous) {
      if (canonicalV2(previous.envelope) !== canonicalV2(operation))
        throw new V2Error("CONFLICT");
      return { ok: true, receipt: previous.receipt as V2Receipt };
    }
    await authorizeNew(tx, operation, grant, "cashier", now);
    if (
      operation.installationId !== authority.cashierInstallationId ||
      operation.kind === "ADJUST_STOCK" ||
      !(grant.allowedKinds as string[]).includes(operation.kind)
    )
      throw new NativeAccessError("CAPABILITY");
    if (operation.sequence !== authority.lastSequence + 1)
      return nativeIncident(
        tx,
        identity,
        scope,
        raw,
        "GAP_OR_CONFLICT",
        now,
        operation,
        authority.lastSequence + 1,
      );
    // Savepoint retains deterministic rejection evidence while rolling back all effects.
    const receipt = await tx.transaction((inner) =>
      commitOperation(inner, authority, grant, operation, now, options),
    );
    return { ok: true, receipt };
  } catch (error) {
    const code = nativeErrorCode(error);
    if (!code) throw error;
    return nativeIncident(tx, identity, scope, raw, code, now, operation);
  }
}
export function createNativeIngestion(
  database: Database,
  now: () => Date,
  options: NativeOptions,
) {
  return {
    ingest(identity: NativeIdentity, raw: unknown): Promise<NativeIngestReply> {
      return database.transaction((tx) =>
        ingestNativeInTransaction(tx, identity, raw, now(), options),
      );
    },
    async submitPrep(
      identity: NativeIdentity,
      raw: unknown,
    ): Promise<{ ok: true; receipt: NativePrepReceipt } | NativeFailure> {
      const scope = nativeScopeSchema.parse(raw);
      return database.transaction(async (tx) => {
        await requireNativeMember(tx, identity, scope.businessId);
        await lockNativeShift(tx, scope.businessId, scope.shiftId);
        const authority = await lockNativeAuthority(
          tx,
          scope.businessId,
          scope.shiftId,
        );
        const at = now();
        const parsed = v2PrepCommandSchema.safeParse(raw);
        if (!parsed.success)
          return nativeIncident(
            tx,
            identity,
            scope,
            raw,
            "UNSUPPORTED_OR_INVALID",
            at,
          );
        const command = parsed.data;
        try {
          const grant = await identifyGrant(
            tx,
            identity,
            command,
            authority,
            false,
          );
          await verifyV2PrepCommand(command, nativeHash);
          const [original] = await tx
            .select()
            .from(v2PrepCommands)
            .where(
              and(
                eq(v2PrepCommands.businessId, scope.businessId),
                eq(v2PrepCommands.id, command.commandId),
              ),
            )
            .limit(1);
          if (
            original &&
            canonicalV2(original.command) !== canonicalV2(command)
          )
            throw new V2Error("CONFLICT");
          if (!original) {
            await authorizeNew(tx, command, grant, "prep", at);
            if (
              authority.state === "closed" ||
              command.installationId === authority.cashierInstallationId
            )
              throw new NativeAccessError("ROLE_OR_STATE");
            // The cashier's sale may arrive later; command acceptance does not
            // mutate order state, and cashier reduction verifies the actual sale.
            await tx.transaction(async (inner) =>
              inner.insert(v2PrepCommands).values({
                id: command.commandId,
                businessId: command.businessId,
                shiftId: command.shiftId,
                authorityId: authority.id,
                authorityEpoch: command.authorityEpoch,
                snapshotId: command.snapshotId,
                snapshotHash: command.snapshotHash,
                installationId: command.installationId,
                grantId: grant.id,
                saleId: command.saleId,
                action: command.action,
                canonicalDigest: command.canonicalDigest,
                command,
                receivedAt: at,
              }),
            );
          }
          return {
            ok: true,
            receipt: {
              schemaVersion: 2,
              commandId: command.commandId,
              businessId: command.businessId,
              shiftId: command.shiftId,
              canonicalDigest: command.canonicalDigest,
              receivedAt: (original?.receivedAt ?? at).toISOString(),
              outcome: "committed",
            },
          };
        } catch (error) {
          const code = nativeErrorCode(error);
          if (!code) throw error;
          return nativeIncident(tx, identity, scope, raw, code, at, command);
        }
      });
    },
  };
}
