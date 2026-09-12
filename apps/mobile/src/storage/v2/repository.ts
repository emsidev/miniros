import {
  applyV2Operation,
  canonicalV2,
  cloneV2,
  freezeV2,
  initialV2Projection,
  operationBodyV2,
  verifyV2Operation,
  verifyV2Snapshot,
  v2DraftSchema,
  v2IdSchema,
  v2ReceiptSchema,
  consumeV2Lines,
  utf8Length,
  type V2Actor,
  type V2Draft,
  type V2Operation,
  type V2Projection,
  type V2Receipt,
  type V2Snapshot,
} from "@miniros/domain/v2";
import { LocalSqliteConnection } from "./connection";
import { migrateLocalDatabase } from "./migrate";
import {
  PersistenceError,
  type AttachmentInput,
  type AttachmentJob,
  type CommitOptions,
  type CommitResult,
  type LocalReceipt,
  type PendingOperation,
  type PersistenceDependencies,
  type Readback,
  type ScopeHandle,
  type SqlExecutor,
  type StorageIdentity,
  type StoredDraft,
} from "./types";
interface ScopeRow {
  snapshot_id: string;
  snapshot_hash: string;
  snapshot_json: string;
  projection_json: string;
  last_sequence: number;
}
interface OperationRow {
  operation_json: string;
  local_receipt_json: string;
  canonical_digest: string;
  sequence: number;
}
interface DraftRow {
  draft_json: string;
  kind?: string;
  revision: number;
  committed_operation_id: string | null;
}
interface Loaded {
  key: string;
  snapshot: V2Snapshot;
  projection: V2Projection;
  actor: V2Actor;
}
const MAX_JOURNAL_OPERATIONS = 10_000;
const MAX_PROJECTION_BYTES = 16_777_216;
function parse<T>(json: string): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new PersistenceError("CORRUPT_LOCAL_DATA");
  }
}
function safePositive(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PersistenceError("INVALID_REVISION");
}
function errorCode(value: string | null): void {
  if (value !== null && !/^[A-Z][A-Z0-9_]{0,63}$/.test(value))
    throw new PersistenceError("INVALID_ERROR_CODE");
}
/** Cashier-only repository. Signed/authorized transport adapters are mandatory dependencies. */
export class LedgerRepository {
  private initialized = false;
  private readonly now: () => string;
  constructor(
    private readonly connection: LocalSqliteConnection,
    private readonly dependencies: PersistenceDependencies,
  ) {
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }
  async initialize(): Promise<void> {
    await migrateLocalDatabase(
      this.connection,
      undefined,
      this.dependencies.fault,
    );
    this.initialized = true;
  }
  private identity(): StorageIdentity {
    if (!this.initialized) throw new PersistenceError("STORAGE_NOT_READY");
    const identity = this.dependencies.authority.currentIdentity();
    if (!identity || identity.locked)
      throw new PersistenceError(
        "STORAGE_LOCKED",
        "Unlock this account's local shift capability to access retained records.",
      );
    [identity.accountId, identity.businessId, identity.installationId].forEach(
      (value) => v2IdSchema.parse(value),
    );
    return freezeV2({ ...identity });
  }
  private stillAuthorized(identity: StorageIdentity): void {
    if (canonicalV2(this.identity()) !== canonicalV2(identity))
      throw new PersistenceError("IDENTITY_CHANGED");
  }
  private key(identity: StorageIdentity, scope: ScopeHandle): string {
    v2IdSchema.parse(scope.shiftId);
    safePositive(scope.authorityEpoch);
    return canonicalV2({
      accountId: identity.accountId,
      businessId: identity.businessId,
      installationId: identity.installationId,
      shiftId: scope.shiftId,
      authorityEpoch: scope.authorityEpoch,
    });
  }
  private checkActor(
    actor: V2Actor,
    identity: StorageIdentity,
    snapshot: V2Snapshot,
    scope: ScopeHandle,
  ): void {
    if (
      actor.role !== "cashier" ||
      actor.businessId !== identity.businessId ||
      actor.shiftId !== scope.shiftId ||
      actor.installationId !== identity.installationId ||
      actor.cashierInstallationId !== identity.installationId ||
      actor.authorityEpoch !== scope.authorityEpoch ||
      snapshot.businessId !== identity.businessId ||
      snapshot.shiftId !== scope.shiftId
    )
      throw new PersistenceError("LOCAL_AUTHORITY_MISMATCH");
  }
  private async load(
    tx: SqlExecutor,
    identity: StorageIdentity,
    scope: ScopeHandle,
  ): Promise<Loaded> {
    const key = this.key(identity, scope);
    const [size] = await tx.all<{ bytes: number }>(
      "SELECT length(CAST(projection_json AS BLOB)) AS bytes FROM v2_local_projections WHERE scope_id=?",
      [key],
    );
    if (size && size.bytes > MAX_PROJECTION_BYTES)
      throw new PersistenceError("PROJECTION_CAPACITY");
    const [row] = await tx.all<ScopeRow>(
      "SELECT s.snapshot_id, s.snapshot_hash, n.snapshot_json, p.projection_json, p.last_sequence FROM v2_local_scopes s JOIN v2_local_snapshots n ON n.scope_id=s.scope_id JOIN v2_local_projections p ON p.scope_id=s.scope_id WHERE s.scope_id=? AND s.account_id=? AND s.business_id=? AND s.installation_id=?",
      [key, identity.accountId, identity.businessId, identity.installationId],
    );
    if (!row) throw new PersistenceError("SCOPE_NOT_AVAILABLE");
    const snapshot = await verifyV2Snapshot(
      parse(row.snapshot_json),
      this.dependencies.hash,
    );
    const actor = await this.dependencies.authority.authorizeSnapshot(
      snapshot,
      identity,
    );
    this.checkActor(actor, identity, snapshot, scope);
    const projection = parse<V2Projection>(row.projection_json);
    if (
      snapshot.id !== row.snapshot_id ||
      snapshot.hash !== row.snapshot_hash ||
      projection.schemaVersion !== 2 ||
      projection.snapshotId !== snapshot.id ||
      projection.snapshotHash !== snapshot.hash ||
      projection.businessId !== identity.businessId ||
      projection.shiftId !== scope.shiftId ||
      projection.cashierInstallationId !== identity.installationId ||
      projection.authorityEpoch !== scope.authorityEpoch ||
      projection.lastSequence !== row.last_sequence
    )
      throw new PersistenceError("CORRUPT_LOCAL_DATA");
    return { key, snapshot, actor, projection };
  }
  async storeSnapshot(input: V2Snapshot): Promise<ScopeHandle> {
    const identity = this.identity();
    const snapshot = await verifyV2Snapshot(input, this.dependencies.hash);
    const actor = await this.dependencies.authority.authorizeSnapshot(
      snapshot,
      identity,
    );
    const scope = {
      shiftId: snapshot.shiftId,
      authorityEpoch: actor.authorityEpoch,
    };
    this.checkActor(actor, identity, snapshot, scope);
    const key = this.key(identity, scope);
    const encoded = canonicalV2(snapshot);
    const projection = initialV2Projection(snapshot, actor);
    await this.connection.transaction(async (tx) => {
      this.stillAuthorized(identity);
      const [existing] = await tx.all<{ snapshot_json: string }>(
        "SELECT snapshot_json FROM v2_local_snapshots WHERE scope_id=?",
        [key],
      );
      if (existing) {
        if (existing.snapshot_json !== encoded)
          throw new PersistenceError("SNAPSHOT_CONFLICT");
        this.stillAuthorized(identity);
        return;
      }
      await tx.run(
        "INSERT INTO v2_local_scopes (scope_id,account_id,business_id,installation_id,shift_id,authority_epoch,snapshot_id,snapshot_hash) VALUES (?,?,?,?,?,?,?,?)",
        [
          key,
          identity.accountId,
          identity.businessId,
          identity.installationId,
          scope.shiftId,
          scope.authorityEpoch,
          snapshot.id,
          snapshot.hash,
        ],
      );
      await tx.run(
        "INSERT INTO v2_local_snapshots (scope_id,snapshot_json) VALUES (?,?)",
        [key, encoded],
      );
      await tx.run(
        "INSERT INTO v2_local_projections (scope_id,last_sequence,projection_json) VALUES (?,?,?)",
        [key, 0, canonicalV2(projection)],
      );
      await this.dependencies.fault?.("snapshot");
      this.stillAuthorized(identity);
    }, this.dependencies.fault);
    this.stillAuthorized(identity);
    return freezeV2(scope);
  }
  private async read<T>(
    scope: ScopeHandle,
    work: (tx: SqlExecutor, loaded: Loaded) => Promise<T>,
  ): Promise<T> {
    const identity = this.identity();
    const result = await this.connection.read(async (tx) => {
      const loaded = await this.load(tx, identity, scope);
      const result = await work(tx, loaded);
      this.stillAuthorized(identity);
      return result;
    });
    this.stillAuthorized(identity);
    return freezeV2(result);
  }
  readSnapshot(scope: ScopeHandle): Promise<V2Snapshot> {
    return this.read(scope, async (_tx, loaded) => loaded.snapshot);
  }
  readProjection(scope: ScopeHandle): Promise<V2Projection> {
    return this.read(scope, async (_tx, loaded) => cloneV2(loaded.projection));
  }
  private validateDraft(draft: V2Draft, snapshot: V2Snapshot): void {
    if (
      draft.businessId !== snapshot.businessId ||
      draft.shiftId !== snapshot.shiftId ||
      draft.snapshotId !== snapshot.id ||
      draft.snapshotHash !== snapshot.hash
    )
      throw new PersistenceError("DRAFT_SCOPE");
    const allowed =
      draft.kind === "packing"
        ? ["answers", "text", "category"]
        : draft.kind === "opening"
          ? ["counts", "openingCashMinor", "text", "category", "uncountedOnly"]
          : ["lines", "text"];
    if (Object.keys(draft.data).some((key) => !allowed.includes(key)))
      throw new PersistenceError("DRAFT_KIND");
    for (const count of draft.data.counts ?? [])
      if (!snapshot.items.some((item) => item.id === count.itemId))
        throw new PersistenceError("UNKNOWN_DRAFT_ITEM");
    for (const answer of draft.data.answers ?? []) {
      if (
        answer.templateVersion !== snapshot.checklist.version ||
        !snapshot.checklist.entries.some((entry) => entry.id === answer.entryId)
      )
        throw new PersistenceError("STALE_CHECKLIST");
      if (
        answer.kind === "authorized-exception" &&
        (!answer.reason?.trim() || !answer.exceptionAuthorizationId)
      )
        throw new PersistenceError("MISSING_EXCEPTION_EVIDENCE");
    }
    if (draft.data.lines?.length) consumeV2Lines(snapshot, draft.data.lines);
  }
  async saveDraft(
    scope: ScopeHandle,
    input: V2Draft,
    expectedRevision: number | null,
  ): Promise<StoredDraft> {
    const identity = this.identity();
    const draft = v2DraftSchema.parse(input);
    if (utf8Length(canonicalV2(draft)) > 262_144)
      throw new PersistenceError("DRAFT_TOO_LARGE");
    if (
      expectedRevision !== null &&
      (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    )
      throw new PersistenceError("INVALID_REVISION");
    if (draft.revision !== (expectedRevision ?? 0) + 1)
      throw new PersistenceError("DRAFT_REVISION");
    const result = await this.connection.transaction(async (tx) => {
      const loaded = await this.load(tx, identity, scope);
      this.validateDraft(draft, loaded.snapshot);
      const [existing] = await tx.all<DraftRow>(
        "SELECT draft_json,kind,revision,committed_operation_id FROM v2_local_drafts WHERE scope_id=? AND draft_id=?",
        [loaded.key, draft.id],
      );
      if (existing && existing.kind !== draft.kind)
        throw new PersistenceError("DRAFT_KIND_CONFLICT");
      if (existing?.committed_operation_id)
        throw new PersistenceError("DRAFT_ALREADY_COMMITTED");
      if ((existing?.revision ?? null) !== expectedRevision)
        throw new PersistenceError("DRAFT_REVISION_CONFLICT");
      if (existing)
        await tx.run(
          "UPDATE v2_local_drafts SET revision=?,draft_json=? WHERE scope_id=? AND draft_id=? AND revision=? AND committed_operation_id IS NULL",
          [
            draft.revision,
            canonicalV2(draft),
            loaded.key,
            draft.id,
            expectedRevision,
          ],
        );
      else
        await tx.run(
          "INSERT INTO v2_local_drafts (scope_id,draft_id,kind,revision,draft_json) VALUES (?,?,?,?,?)",
          [
            loaded.key,
            draft.id,
            draft.kind,
            draft.revision,
            canonicalV2(draft),
          ],
        );
      this.stillAuthorized(identity);
      return { draft: cloneV2(draft), committedOperationId: null };
    }, this.dependencies.fault);
    this.stillAuthorized(identity);
    return freezeV2(result);
  }
  readDraft(scope: ScopeHandle, draftId: string): Promise<StoredDraft | null> {
    v2IdSchema.parse(draftId);
    return this.read(scope, async (tx, loaded) => {
      const [row] = await tx.all<DraftRow>(
        "SELECT draft_json,kind,revision,committed_operation_id FROM v2_local_drafts WHERE scope_id=? AND draft_id=?",
        [loaded.key, draftId],
      );
      if (!row) return null;
      const draft = v2DraftSchema.parse(parse(row.draft_json));
      this.validateDraft(draft, loaded.snapshot);
      if (
        draft.revision !== row.revision ||
        draft.kind !== row.kind ||
        draft.id !== draftId
      )
        throw new PersistenceError("CORRUPT_LOCAL_DATA");
      return { draft, committedOperationId: row.committed_operation_id };
    });
  }
  private receipt(row: OperationRow, operation: V2Operation): LocalReceipt {
    const receipt = parse<LocalReceipt>(row.local_receipt_json);
    if (
      receipt.schemaVersion !== 2 ||
      receipt.destination !== "local" ||
      receipt.outcome !== "committed" ||
      receipt.operationId !== operation.operationId ||
      receipt.canonicalDigest !== operation.canonicalDigest ||
      receipt.sequence !== operation.sequence ||
      !Number.isFinite(Date.parse(receipt.savedAt))
    )
      throw new PersistenceError("CORRUPT_LOCAL_RECEIPT");
    return receipt;
  }
  private async checkDraftCommit(
    tx: SqlExecutor,
    loaded: Loaded,
    operation: V2Operation,
    options: CommitOptions,
  ): Promise<void> {
    if (!options.draft) return;
    v2IdSchema.parse(options.draft.draftId);
    safePositive(options.draft.revision);
    const [row] = await tx.all<DraftRow>(
      "SELECT draft_json,kind,revision,committed_operation_id FROM v2_local_drafts WHERE scope_id=? AND draft_id=?",
      [loaded.key, options.draft.draftId],
    );
    if (
      !row ||
      row.revision !== options.draft.revision ||
      row.committed_operation_id
    )
      throw new PersistenceError("DRAFT_REVISION_CONFLICT");
    const draft = v2DraftSchema.parse(parse(row.draft_json));
    this.validateDraft(draft, loaded.snapshot);
    if (operation.kind === "SALE") {
      if (
        draft.kind !== "cart" ||
        canonicalV2(draft.data.lines ?? []) !==
          canonicalV2(operation.payload.lines)
      )
        throw new PersistenceError("DRAFT_OPERATION_MISMATCH");
    } else if (operation.kind === "OPEN_SHIFT") {
      if (
        draft.kind !== "opening" ||
        canonicalV2(draft.data.counts ?? []) !==
          canonicalV2(operation.payload.counts) ||
        draft.data.openingCashMinor !== operation.payload.openingCashMinor
      )
        throw new PersistenceError("DRAFT_OPERATION_MISMATCH");
    } else throw new PersistenceError("DRAFT_OPERATION_MISMATCH");
  }
  async commit(
    input: V2Operation,
    options: CommitOptions = {},
  ): Promise<CommitResult> {
    const identity = this.identity();
    const operation = await verifyV2Operation(input, this.dependencies.hash);
    const scope = {
      shiftId: operation.shiftId,
      authorityEpoch: operation.authorityEpoch,
    };
    const result = await this.connection.transaction(async (tx) => {
      const loaded = await this.load(tx, identity, scope);
      const actor = await this.dependencies.authority.authorizeOperation(
        operation,
        loaded.snapshot,
        identity,
      );
      this.checkActor(actor, identity, loaded.snapshot, scope);
      const [existing] = await tx.all<OperationRow>(
        "SELECT operation_json,local_receipt_json,canonical_digest,sequence FROM v2_local_operations WHERE scope_id=? AND operation_id=?",
        [loaded.key, operation.operationId],
      );
      if (existing) {
        const stored = await verifyV2Operation(
          parse(existing.operation_json),
          this.dependencies.hash,
        );
        if (
          existing.canonical_digest !== operation.canonicalDigest ||
          existing.sequence !== operation.sequence ||
          canonicalV2(operationBodyV2(stored)) !==
            canonicalV2(operationBodyV2(operation))
        )
          throw new PersistenceError("OPERATION_CONFLICT");
        // Reapply performs scope/permission/dedup checks without business effects.
        const projection = await applyV2Operation(
          loaded.snapshot,
          loaded.projection,
          operation,
          actor,
          this.dependencies.hash,
        );
        this.stillAuthorized(identity);
        return {
          receipt: this.receipt(existing, operation),
          projection,
          duplicate: true,
        };
      }
      if (loaded.projection.lastSequence >= MAX_JOURNAL_OPERATIONS)
        throw new PersistenceError(
          "JOURNAL_CAPACITY",
          "This retained shift has reached its local capacity. Export/reconcile without deleting records.",
        );
      await this.checkDraftCommit(tx, loaded, operation, options);
      const projection = await applyV2Operation(
        loaded.snapshot,
        loaded.projection,
        operation,
        actor,
        this.dependencies.hash,
      );
      const projectionJson = canonicalV2(projection);
      if (utf8Length(projectionJson) > MAX_PROJECTION_BYTES)
        throw new PersistenceError("PROJECTION_CAPACITY");
      const savedAt = this.now();
      if (!Number.isFinite(Date.parse(savedAt)))
        throw new PersistenceError("INVALID_LOCAL_TIME");
      const receipt: LocalReceipt = {
        schemaVersion: 2,
        destination: "local",
        outcome: "committed",
        operationId: operation.operationId,
        canonicalDigest: operation.canonicalDigest,
        sequence: operation.sequence,
        savedAt,
      };
      await tx.run(
        "INSERT INTO v2_local_operations (scope_id,operation_id,sequence,canonical_digest,operation_json,local_receipt_json,saved_at) VALUES (?,?,?,?,?,?,?)",
        [
          loaded.key,
          operation.operationId,
          operation.sequence,
          operation.canonicalDigest,
          canonicalV2(operation),
          canonicalV2(receipt),
          savedAt,
        ],
      );
      await this.dependencies.fault?.("journal");
      await tx.run(
        "UPDATE v2_local_projections SET last_sequence=?,projection_json=? WHERE scope_id=?",
        [projection.lastSequence, projectionJson, loaded.key],
      );
      await this.dependencies.fault?.("projection");
      if (operation.kind === "SALE")
        for (const [index, tender] of operation.payload.tenders.entries())
          await tx.run(
            "INSERT INTO v2_local_tenders (scope_id,operation_id,tender_index,method,tendered_minor,change_minor) VALUES (?,?,?,?,?,?)",
            [
              loaded.key,
              operation.operationId,
              index,
              tender.method,
              tender.tenderedMinor,
              tender.changeMinor,
            ],
          );
      await this.dependencies.fault?.("tenders");
      await tx.run(
        "INSERT INTO v2_local_outbox (scope_id,operation_id,destination) VALUES (?,?,?)",
        [loaded.key, operation.operationId, "peer"],
      );
      await this.dependencies.fault?.("peer-outbox");
      await tx.run(
        "INSERT INTO v2_local_outbox (scope_id,operation_id,destination) VALUES (?,?,?)",
        [loaded.key, operation.operationId, "cloud"],
      );
      await this.dependencies.fault?.("cloud-outbox");
      if (options.draft) {
        const updated = await tx.run(
          "UPDATE v2_local_drafts SET committed_operation_id=? WHERE scope_id=? AND draft_id=? AND revision=? AND committed_operation_id IS NULL",
          [
            operation.operationId,
            loaded.key,
            options.draft.draftId,
            options.draft.revision,
          ],
        );
        if (updated.changes !== 1)
          throw new PersistenceError("DRAFT_REVISION_CONFLICT");
      }
      await this.dependencies.fault?.("draft-commit");
      if ((options.attachments?.length ?? 0) > 100)
        throw new PersistenceError("ATTACHMENT_LIMIT");
      for (const attachment of options.attachments ?? [])
        await this.insertAttachment(
          tx,
          loaded.key,
          attachment,
          operation.operationId,
        );
      await this.dependencies.fault?.("attachments");
      const [persisted] = await tx.all<OperationRow>(
        "SELECT operation_json,local_receipt_json,canonical_digest,sequence FROM v2_local_operations WHERE scope_id=? AND operation_id=?",
        [loaded.key, operation.operationId],
      );
      if (!persisted) throw new PersistenceError("READBACK_FAILED");
      this.receipt(persisted, operation);
      await this.dependencies.fault?.("local-receipt");
      this.stillAuthorized(identity);
      return { receipt, projection, duplicate: false };
    }, this.dependencies.fault);
    this.stillAuthorized(identity);
    return freezeV2(result);
  }
  pending(
    scope: ScopeHandle,
    destination: "peer" | "cloud",
    limit = 100,
  ): Promise<PendingOperation[]> {
    this.destination(destination);
    this.limit(limit);
    return this.read(scope, async (tx, loaded) => {
      const rows = await tx.all<{
        operation_json: string;
        attempt_count: number;
        last_error_code: string | null;
      }>(
        "SELECT o.operation_json,q.attempt_count,q.last_error_code FROM v2_local_outbox q JOIN v2_local_operations o ON o.scope_id=q.scope_id AND o.operation_id=q.operation_id LEFT JOIN v2_local_receipts r ON r.scope_id=q.scope_id AND r.operation_id=q.operation_id AND r.destination=q.destination WHERE q.scope_id=? AND q.destination=? AND r.operation_id IS NULL ORDER BY o.sequence LIMIT ?",
        [loaded.key, destination, limit],
      );
      return Promise.all(
        rows.map(async (row) => ({
          operation: await verifyV2Operation(
            parse(row.operation_json),
            this.dependencies.hash,
          ),
          destination,
          attemptCount: row.attempt_count,
          lastErrorCode: row.last_error_code,
        })),
      );
    });
  }
  private destination(destination: string): void {
    if (destination !== "peer" && destination !== "cloud")
      throw new PersistenceError("INVALID_DESTINATION");
  }
  private limit(limit: number): void {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500)
      throw new PersistenceError("INVALID_LIMIT");
  }
  async recordAttempt(
    scope: ScopeHandle,
    operationId: string,
    destination: "peer" | "cloud",
    lastErrorCode: string | null,
  ): Promise<void> {
    v2IdSchema.parse(operationId);
    this.destination(destination);
    errorCode(lastErrorCode);
    const identity = this.identity();
    await this.connection.transaction(async (tx) => {
      const loaded = await this.load(tx, identity, scope);
      const updated = await tx.run(
        "UPDATE v2_local_outbox SET attempt_count=attempt_count+1,last_error_code=? WHERE scope_id=? AND operation_id=? AND destination=? AND NOT EXISTS (SELECT 1 FROM v2_local_receipts r WHERE r.scope_id=v2_local_outbox.scope_id AND r.operation_id=v2_local_outbox.operation_id AND r.destination=v2_local_outbox.destination)",
        [lastErrorCode, loaded.key, operationId, destination],
      );
      if (updated.changes !== 1)
        throw new PersistenceError("PENDING_OPERATION_NOT_FOUND");
      this.stillAuthorized(identity);
    });
  }
  async recordReceipt(input: V2Receipt): Promise<V2Receipt> {
    const identity = this.identity();
    const receipt = v2ReceiptSchema.parse(input);
    const scope = {
      shiftId: receipt.shiftId,
      authorityEpoch: receipt.authorityEpoch,
    };
    const result = await this.connection.transaction(async (tx) => {
      const loaded = await this.load(tx, identity, scope);
      const [row] = await tx.all<OperationRow>(
        "SELECT operation_json,local_receipt_json,canonical_digest,sequence FROM v2_local_operations WHERE scope_id=? AND operation_id=?",
        [loaded.key, receipt.operationId],
      );
      if (!row) throw new PersistenceError("UNKNOWN_RECEIPT");
      const operation = await verifyV2Operation(
        parse(row.operation_json),
        this.dependencies.hash,
      );
      if (
        receipt.businessId !== operation.businessId ||
        receipt.installationId !== operation.installationId ||
        receipt.snapshotId !== operation.snapshotId ||
        receipt.snapshotHash !== operation.snapshotHash ||
        receipt.canonicalDigest !== operation.canonicalDigest ||
        receipt.sequence !== operation.sequence
      )
        throw new PersistenceError("RECEIPT_MISMATCH");
      await this.dependencies.authority.authorizeReceipt(
        receipt,
        operation,
        identity,
      );
      const [existing] = await tx.all<{ receipt_json: string }>(
        "SELECT receipt_json FROM v2_local_receipts WHERE scope_id=? AND operation_id=? AND destination=?",
        [loaded.key, receipt.operationId, receipt.destination],
      );
      const json = canonicalV2(receipt);
      if (existing) {
        if (existing.receipt_json !== json)
          throw new PersistenceError("RECEIPT_CONFLICT");
      } else
        await tx.run(
          "INSERT INTO v2_local_receipts (scope_id,operation_id,destination,receipt_json) VALUES (?,?,?,?)",
          [loaded.key, receipt.operationId, receipt.destination, json],
        );
      this.stillAuthorized(identity);
      return receipt;
    });
    this.stillAuthorized(identity);
    return freezeV2(result);
  }
  private async insertAttachment(
    tx: SqlExecutor,
    key: string,
    attachment: AttachmentInput,
    operationId: string | null,
  ): Promise<void> {
    v2IdSchema.parse(attachment.attachmentId);
    if (
      !/^[a-f0-9]{64}$/.test(attachment.mediaDigest) ||
      typeof attachment.localUri !== "string" ||
      attachment.localUri.length > 2048 ||
      !/^(?:file|content):\/\//.test(attachment.localUri)
    )
      throw new PersistenceError("INVALID_ATTACHMENT");
    const [old] = await tx.all<{
      operation_id: string | null;
      local_uri: string;
      media_digest: string;
    }>(
      "SELECT operation_id,local_uri,media_digest FROM v2_local_attachments WHERE scope_id=? AND attachment_id=?",
      [key, attachment.attachmentId],
    );
    if (old) {
      if (
        old.operation_id !== operationId ||
        old.local_uri !== attachment.localUri ||
        old.media_digest !== attachment.mediaDigest
      )
        throw new PersistenceError("ATTACHMENT_CONFLICT");
      return;
    }
    await tx.run(
      "INSERT INTO v2_local_attachments (scope_id,attachment_id,operation_id,local_uri,media_digest,state) VALUES (?,?,?,?,?,?)",
      [
        key,
        attachment.attachmentId,
        operationId,
        attachment.localUri,
        attachment.mediaDigest,
        "pending",
      ],
    );
  }
  async addAttachment(
    scope: ScopeHandle,
    attachment: AttachmentInput,
    operationId: string | null = null,
  ): Promise<void> {
    const identity = this.identity();
    if (operationId) v2IdSchema.parse(operationId);
    await this.connection.transaction(async (tx) => {
      const loaded = await this.load(tx, identity, scope);
      await this.insertAttachment(tx, loaded.key, attachment, operationId);
      this.stillAuthorized(identity);
    }, this.dependencies.fault);
  }
  attachments(scope: ScopeHandle, limit = 100): Promise<AttachmentJob[]> {
    this.limit(limit);
    return this.read(scope, async (tx, loaded) => {
      const rows = await tx.all<{
        attachment_id: string;
        operation_id: string | null;
        local_uri: string;
        media_digest: string;
        state: AttachmentJob["state"];
        attempt_count: number;
        last_error_code: string | null;
      }>(
        "SELECT attachment_id,operation_id,local_uri,media_digest,state,attempt_count,last_error_code FROM v2_local_attachments WHERE scope_id=? AND state!='linked' ORDER BY attachment_id LIMIT ?",
        [loaded.key, limit],
      );
      return rows.map((row) => ({
        attachmentId: row.attachment_id,
        operationId: row.operation_id,
        localUri: row.local_uri,
        mediaDigest: row.media_digest,
        state: row.state,
        attemptCount: row.attempt_count,
        lastErrorCode: row.last_error_code,
      }));
    });
  }
  async updateAttachment(
    scope: ScopeHandle,
    attachmentId: string,
    state: AttachmentJob["state"],
    lastErrorCode: string | null = null,
  ): Promise<void> {
    const identity = this.identity();
    v2IdSchema.parse(attachmentId);
    errorCode(lastErrorCode);
    if (!["pending", "uploaded", "linked"].includes(state))
      throw new PersistenceError("INVALID_ATTACHMENT_STATE");
    await this.connection.transaction(async (tx) => {
      const loaded = await this.load(tx, identity, scope);
      const [current] = await tx.all<{ state: AttachmentJob["state"] }>(
        "SELECT state FROM v2_local_attachments WHERE scope_id=? AND attachment_id=?",
        [loaded.key, attachmentId],
      );
      if (
        !current ||
        (current.state === "linked" && state !== "linked") ||
        (current.state === "pending" && state === "linked") ||
        (current.state === "uploaded" && state === "pending")
      )
        throw new PersistenceError("INVALID_ATTACHMENT_TRANSITION");
      await tx.run(
        "UPDATE v2_local_attachments SET state=?,attempt_count=attempt_count+1,last_error_code=? WHERE scope_id=? AND attachment_id=?",
        [state, lastErrorCode, loaded.key, attachmentId],
      );
      this.stillAuthorized(identity);
    });
  }
  readiness(scope: ScopeHandle): Promise<Readback> {
    return this.read(scope, async (tx, loaded) => {
      const checks = await tx.all<Record<string, string>>(
        "PRAGMA quick_check(1)",
      );
      if (checks.length !== 1 || Object.values(checks[0] ?? {})[0] !== "ok")
        throw new PersistenceError("INTEGRITY_CHECK_FAILED");
      const [count] = await tx.all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM v2_local_operations WHERE scope_id=?",
        [loaded.key],
      );
      const operationCount = count?.n ?? 0;
      if (
        operationCount > MAX_JOURNAL_OPERATIONS ||
        operationCount !== loaded.projection.lastSequence ||
        Object.keys(loaded.projection.seen).length !== operationCount
      )
        throw new PersistenceError("READBACK_FAILED");
      let expectedTenders = 0;
      let replayed = initialV2Projection(loaded.snapshot, loaded.actor);
      const identity = this.identity();
      for (let offset = 0; offset < operationCount; offset += 64) {
        const operations = await tx.all<OperationRow>(
          "SELECT operation_json,local_receipt_json,canonical_digest,sequence FROM v2_local_operations WHERE scope_id=? ORDER BY sequence LIMIT 64 OFFSET ?",
          [loaded.key, offset],
        );
        for (const [index, row] of operations.entries()) {
          const operation = await verifyV2Operation(
            parse(row.operation_json),
            this.dependencies.hash,
          );
          if (
            row.sequence !== offset + index + 1 ||
            operation.sequence !== row.sequence ||
            row.canonical_digest !== operation.canonicalDigest
          )
            throw new PersistenceError("READBACK_FAILED");
          this.receipt(row, operation);
          const actor = await this.dependencies.authority.authorizeOperation(
            operation,
            loaded.snapshot,
            identity,
          );
          this.checkActor(actor, identity, loaded.snapshot, scope);
          replayed = await applyV2Operation(
            loaded.snapshot,
            replayed,
            operation,
            actor,
            this.dependencies.hash,
          );
          if (operation.kind === "SALE") {
            const evidence = await tx.all<{
              tender_index: number;
              method: string;
              tendered_minor: number;
              change_minor: number;
            }>(
              "SELECT tender_index,method,tendered_minor,change_minor FROM v2_local_tenders WHERE scope_id=? AND operation_id=? ORDER BY tender_index LIMIT 11",
              [loaded.key, operation.operationId],
            );
            if (
              canonicalV2(evidence) !==
              canonicalV2(
                operation.payload.tenders.map((tender, tender_index) => ({
                  tender_index,
                  method: tender.method,
                  tendered_minor: tender.tenderedMinor,
                  change_minor: tender.changeMinor,
                })),
              )
            )
              throw new PersistenceError("TENDER_READBACK_MISMATCH");
            expectedTenders += operation.payload.tenders.length;
          }
        }
      }
      if (canonicalV2(replayed) !== canonicalV2(loaded.projection))
        throw new PersistenceError("PROJECTION_READBACK_MISMATCH");
      const [tenders] = await tx.all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM v2_local_tenders WHERE scope_id=?",
        [loaded.key],
      );
      const [outbox] = await tx.all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM v2_local_outbox WHERE scope_id=?",
        [loaded.key],
      );
      if (tenders?.n !== expectedTenders || outbox?.n !== operationCount * 2)
        throw new PersistenceError("READBACK_FAILED");
      const pending = await tx.all<{ destination: string; n: number }>(
        "SELECT q.destination,COUNT(*) AS n FROM v2_local_outbox q LEFT JOIN v2_local_receipts r ON r.scope_id=q.scope_id AND r.operation_id=q.operation_id AND r.destination=q.destination WHERE q.scope_id=? AND r.operation_id IS NULL GROUP BY q.destination",
        [loaded.key],
      );
      const [attachments] = await tx.all<{ n: number }>(
        "SELECT COUNT(*) AS n FROM v2_local_attachments WHERE scope_id=? AND state!='linked'",
        [loaded.key],
      );
      return {
        ready: true,
        snapshot: loaded.snapshot,
        projection: cloneV2(loaded.projection),
        operationCount,
        peerPending: pending.find((row) => row.destination === "peer")?.n ?? 0,
        cloudPending:
          pending.find((row) => row.destination === "cloud")?.n ?? 0,
        attachmentPending: attachments?.n ?? 0,
      };
    });
  }
  async diagnostics(scope: ScopeHandle): Promise<string> {
    const identity = this.identity();
    const result = await this.readiness(scope);
    this.stillAuthorized(identity);
    // Deliberately no IDs, names, payloads, signatures, local media paths, secrets or free-form errors.
    return canonicalV2({
      schemaVersion: 2,
      integrity: "checked",
      state: result.projection.state,
      lastSequence: result.projection.lastSequence,
      operationCount: result.operationCount,
      peerPending: result.peerPending,
      cloudPending: result.cloudPending,
      attachmentPending: result.attachmentPending,
    });
  }
  close(): Promise<void> {
    this.initialized = false;
    return this.connection.close();
  }
}
