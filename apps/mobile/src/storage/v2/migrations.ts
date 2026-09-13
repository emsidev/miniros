/** Root-owned, additive migrations for the isolated miniros-v2-ledger.db file.
 * The migrator sets user_version in the same exclusive transaction as each step.
 * Failure rolls back and preserves the file; never reset/delete it for recovery.
 */
export const LOCAL_MIGRATIONS: readonly {
  version: number;
  statements: readonly string[];
}[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE v2_local_scopes (
        scope_id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL, business_id TEXT NOT NULL, installation_id TEXT NOT NULL,
        shift_id TEXT NOT NULL, authority_epoch INTEGER NOT NULL CHECK(typeof(authority_epoch) = 'integer' AND authority_epoch BETWEEN 1 AND 9007199254740991),
        snapshot_id TEXT NOT NULL, snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash) = 64),
        UNIQUE(account_id, business_id, installation_id, shift_id, authority_epoch)
      )`,
      `CREATE TABLE v2_local_snapshots (
        scope_id TEXT PRIMARY KEY NOT NULL REFERENCES v2_local_scopes(scope_id) ON DELETE RESTRICT,
        snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json))
      )`,
      `CREATE TABLE v2_local_projections (
        scope_id TEXT PRIMARY KEY NOT NULL REFERENCES v2_local_scopes(scope_id) ON DELETE RESTRICT,
        last_sequence INTEGER NOT NULL CHECK(typeof(last_sequence) = 'integer' AND last_sequence BETWEEN 0 AND 9007199254740991),
        projection_json TEXT NOT NULL CHECK(json_valid(projection_json))
      )`,
      `CREATE TABLE v2_local_operations (
        scope_id TEXT NOT NULL REFERENCES v2_local_scopes(scope_id) ON DELETE RESTRICT,
        operation_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK(typeof(sequence) = 'integer' AND sequence BETWEEN 1 AND 9007199254740991),
        canonical_digest TEXT NOT NULL CHECK(length(canonical_digest) = 64),
        operation_json TEXT NOT NULL CHECK(json_valid(operation_json)),
        local_receipt_json TEXT NOT NULL CHECK(json_valid(local_receipt_json)), saved_at TEXT NOT NULL,
        PRIMARY KEY(scope_id, operation_id), UNIQUE(scope_id, sequence)
      )`,
      `CREATE TABLE v2_local_tenders (
        scope_id TEXT NOT NULL, operation_id TEXT NOT NULL,
        tender_index INTEGER NOT NULL CHECK(typeof(tender_index) = 'integer' AND tender_index BETWEEN 0 AND 9),
        method TEXT NOT NULL CHECK(method IN ('cash','manual_digital')),
        tendered_minor INTEGER NOT NULL CHECK(typeof(tendered_minor) = 'integer' AND tendered_minor BETWEEN 1 AND 9007199254740991),
        change_minor INTEGER NOT NULL CHECK(typeof(change_minor) = 'integer' AND change_minor BETWEEN 0 AND tendered_minor AND (method = 'cash' OR change_minor = 0)),
        PRIMARY KEY(scope_id, operation_id, tender_index),
        FOREIGN KEY(scope_id, operation_id) REFERENCES v2_local_operations(scope_id, operation_id) ON DELETE RESTRICT
      )`,
      `CREATE TABLE v2_local_drafts (
        scope_id TEXT NOT NULL REFERENCES v2_local_scopes(scope_id) ON DELETE RESTRICT, draft_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('packing','opening','cart')),
        revision INTEGER NOT NULL CHECK(typeof(revision) = 'integer' AND revision BETWEEN 1 AND 9007199254740991),
        draft_json TEXT NOT NULL CHECK(json_valid(draft_json)), committed_operation_id TEXT,
        PRIMARY KEY(scope_id, draft_id),
        FOREIGN KEY(scope_id, committed_operation_id) REFERENCES v2_local_operations(scope_id, operation_id) ON DELETE RESTRICT
      )`,
      `CREATE TABLE v2_local_outbox (
        scope_id TEXT NOT NULL, operation_id TEXT NOT NULL, destination TEXT NOT NULL CHECK(destination IN ('peer','cloud')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(typeof(attempt_count) = 'integer' AND attempt_count BETWEEN 0 AND 9007199254740991),
        last_error_code TEXT CHECK(length(last_error_code) <= 128), next_attempt_at TEXT,
        PRIMARY KEY(scope_id, operation_id, destination),
        FOREIGN KEY(scope_id, operation_id) REFERENCES v2_local_operations(scope_id, operation_id) ON DELETE RESTRICT
      )`,
      `CREATE TABLE v2_local_receipts (
        scope_id TEXT NOT NULL, operation_id TEXT NOT NULL, destination TEXT NOT NULL,
        receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json)),
        PRIMARY KEY(scope_id, operation_id, destination),
        FOREIGN KEY(scope_id, operation_id, destination) REFERENCES v2_local_outbox(scope_id, operation_id, destination) ON DELETE RESTRICT
      )`,
      `CREATE INDEX v2_local_outbox_pending_idx ON v2_local_outbox(scope_id, destination, next_attempt_at)`,
      ...["scopes", "snapshots", "operations", "tenders", "receipts"].flatMap(
        (name) => [
          `CREATE TRIGGER v2_local_${name}_immutable_update BEFORE UPDATE ON v2_local_${name} BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_EVIDENCE'); END`,
          `CREATE TRIGGER v2_local_${name}_immutable_delete BEFORE DELETE ON v2_local_${name} BEGIN SELECT RAISE(ABORT, 'IMMUTABLE_EVIDENCE'); END`,
        ],
      ),
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE v2_local_attachments (
        scope_id TEXT NOT NULL REFERENCES v2_local_scopes(scope_id) ON DELETE RESTRICT, attachment_id TEXT NOT NULL,
        operation_id TEXT, local_uri TEXT NOT NULL, media_digest TEXT NOT NULL CHECK(length(media_digest) = 64),
        state TEXT NOT NULL CHECK(state IN ('pending','uploaded','linked')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(typeof(attempt_count) = 'integer' AND attempt_count BETWEEN 0 AND 9007199254740991),
        last_error_code TEXT CHECK(length(last_error_code) <= 128),
        PRIMARY KEY(scope_id, attachment_id),
        FOREIGN KEY(scope_id, operation_id) REFERENCES v2_local_operations(scope_id, operation_id) ON DELETE RESTRICT
      )`,
      `CREATE INDEX v2_local_attachments_pending_idx ON v2_local_attachments(scope_id, state)`,
    ],
  },
];
