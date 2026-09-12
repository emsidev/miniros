import type {
  V2Actor,
  V2Draft,
  V2Hash,
  V2Operation,
  V2Projection,
  V2Receipt,
  V2Snapshot,
} from "@miniros/domain/v2";
export type SqlParameter = string | number | null;
export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  run(
    sql: string,
    parameters?: readonly SqlParameter[],
  ): Promise<{ changes: number }>;
  all<T>(sql: string, parameters?: readonly SqlParameter[]): Promise<T[]>;
}
export interface RawSqliteConnection extends SqlExecutor {
  close(): Promise<void>;
}
export type FaultPoint =
  | "snapshot"
  | "journal"
  | "projection"
  | "tenders"
  | "peer-outbox"
  | "cloud-outbox"
  | "local-receipt"
  | "draft-commit"
  | "attachments"
  | "before-commit"
  | "after-commit"
  | `migration:${number}:${number}`;
export type FaultHook = (point: FaultPoint) => void | Promise<void>;
export type StorageIdentity = Readonly<{
  accountId: string;
  businessId: string;
  installationId: string;
  locked: boolean;
}>;
/** Constructor-injected trusted adapters, never reconstructed from the operation payload. */
export interface StorageAuthority {
  currentIdentity(): StorageIdentity | null;
  authorizeSnapshot(
    snapshot: V2Snapshot,
    identity: StorageIdentity,
  ): Promise<V2Actor>;
  authorizeOperation(
    operation: V2Operation,
    snapshot: V2Snapshot,
    identity: StorageIdentity,
  ): Promise<V2Actor>;
  authorizeReceipt(
    receipt: V2Receipt,
    operation: V2Operation,
    identity: StorageIdentity,
  ): Promise<void>;
}
export interface PersistenceDependencies {
  authority: StorageAuthority;
  hash: V2Hash;
  now?: () => string;
  fault?: FaultHook;
}
export type LocalReceipt = Readonly<{
  schemaVersion: 2;
  destination: "local";
  outcome: "committed";
  operationId: string;
  canonicalDigest: string;
  sequence: number;
  savedAt: string;
}>;
export type ScopeHandle = Readonly<{ shiftId: string; authorityEpoch: number }>;
export type DraftCommit = Readonly<{ draftId: string; revision: number }>;
export type AttachmentInput = Readonly<{
  attachmentId: string;
  localUri: string;
  mediaDigest: string;
}>;
export type AttachmentJob = AttachmentInput &
  Readonly<{
    operationId: string | null;
    state: "pending" | "uploaded" | "linked";
    attemptCount: number;
    lastErrorCode: string | null;
  }>;
export type CommitOptions = Readonly<{
  draft?: DraftCommit;
  attachments?: readonly AttachmentInput[];
}>;
export type CommitResult = Readonly<{
  receipt: LocalReceipt;
  projection: V2Projection;
  duplicate: boolean;
}>;
export type StoredDraft = Readonly<{
  draft: V2Draft;
  committedOperationId: string | null;
}>;
export type PendingOperation = Readonly<{
  operation: V2Operation;
  destination: "peer" | "cloud";
  attemptCount: number;
  lastErrorCode: string | null;
}>;
export type Readback = Readonly<{
  ready: true;
  snapshot: V2Snapshot;
  projection: V2Projection;
  operationCount: number;
  peerPending: number;
  cloudPending: number;
  attachmentPending: number;
}>;
export type LocalMigration = Readonly<{
  version: number;
  statements: readonly string[];
}>;
export class PersistenceError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "PersistenceError";
  }
}
