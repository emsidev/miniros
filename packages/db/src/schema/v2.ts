/** Additive v2 persistence. Exact envelopes remain the replay source of truth. */
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./business";
import { authUsers } from "./auth";
import { employees } from "./employees";
import { shifts, shiftAssignments } from "./shifts";

export const v2Snapshots = pgTable(
  "v2_snapshots",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    schemaVersion: integer("schema_version").default(2).notNull(),
    version: bigint("version", { mode: "number" }).notNull(),
    catalogVersion: text("catalog_version").notNull(),
    recipeVersion: text("recipe_version").notNull(),
    costingVersion: text("costing_version").notNull(),
    checklistId: uuid("checklist_id").notNull(),
    checklistVersion: bigint("checklist_version", { mode: "number" }).notNull(),
    hash: text("hash").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("v2_snapshots_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_snapshots_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_snapshots_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_snapshots_creator_fk",
      columns: [t.createdBy],
      foreignColumns: [authUsers.id],
    }).onDelete("restrict"),
    uniqueIndex("v2_snapshots_version_key").on(
      t.businessId,
      t.shiftId,
      t.version,
    ),
    uniqueIndex("v2_snapshots_scope_hash_key").on(
      t.businessId,
      t.shiftId,
      t.id,
      t.hash,
    ),
    check("v2_snapshots_schema_version", sql`${t.schemaVersion} = 2`),
    check(
      "v2_snapshots_snapshot_object",
      sql`jsonb_typeof(${t.snapshot}) = 'object'`,
    ),
    check(
      "v2_snapshots_version_safe",
      sql`${t.version} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_snapshots_checklist_version_safe",
      sql`${t.checklistVersion} BETWEEN 1 AND 9007199254740991`,
    ),
    check("v2_snapshots_hash_sha256", sql`${t.hash} ~ '^[a-f0-9]{64}$'`),
  ],
).enableRLS();

export const v2Authorities = pgTable(
  "v2_authorities",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    cashierInstallationId: uuid("cashier_installation_id").notNull(),
    authorityEpoch: bigint("authority_epoch", { mode: "number" }).notNull(),
    lastSequence: bigint("last_sequence", { mode: "number" })
      .default(0)
      .notNull(),
    state: text("state").default("unopened").notNull(),
    projection: jsonb("projection").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("v2_authorities_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_authorities_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_authorities_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    uniqueIndex("v2_authorities_one_per_shift").on(t.businessId, t.shiftId),
    uniqueIndex("v2_authorities_full_scope_key").on(
      t.businessId,
      t.shiftId,
      t.id,
      t.authorityEpoch,
      t.snapshotId,
      t.snapshotHash,
    ),
    foreignKey({
      name: "v2_authorities_snapshot_fk",
      columns: [t.businessId, t.shiftId, t.snapshotId, t.snapshotHash],
      foreignColumns: [
        v2Snapshots.businessId,
        v2Snapshots.shiftId,
        v2Snapshots.id,
        v2Snapshots.hash,
      ],
    }).onDelete("restrict"),
    check(
      "v2_authorities_state_check",
      sql`${t.state} IN ('unopened','open','closed')`,
    ),
    check(
      "v2_authorities_projection_object",
      sql`jsonb_typeof(${t.projection}) = 'object'`,
    ),
    check(
      "v2_authorities_snapshot_hash_sha256",
      sql`${t.snapshotHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "v2_authorities_authority_epoch_safe",
      sql`${t.authorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_authorities_last_sequence_safe",
      sql`${t.lastSequence} BETWEEN 0 AND 9007199254740991`,
    ),
  ],
).enableRLS();

export const v2DeviceGrants = pgTable(
  "v2_device_grants",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    authorityId: uuid("authority_id").notNull(),
    userId: uuid("user_id").notNull(),
    employeeId: uuid("employee_id").notNull(),
    assignmentId: uuid("assignment_id").notNull(),
    installationId: uuid("installation_id").notNull(),
    authorityEpoch: bigint("authority_epoch", { mode: "number" }).notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    role: text("role").notNull(),
    allowedKinds: jsonb("allowed_kinds").notNull(),
    grantSpki: text("grant_spki").notNull(),
    issuedBy: uuid("issued_by").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by"),
    revocationReason: text("revocation_reason"),
  },
  (t) => [
    uniqueIndex("v2_device_grants_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_device_grants_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_device_grants_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_device_grants_creator_fk",
      columns: [t.issuedBy],
      foreignColumns: [authUsers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_device_grants_authority_scope_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.authorityId,
        t.authorityEpoch,
        t.snapshotId,
        t.snapshotHash,
      ],
      foreignColumns: [
        v2Authorities.businessId,
        v2Authorities.shiftId,
        v2Authorities.id,
        v2Authorities.authorityEpoch,
        v2Authorities.snapshotId,
        v2Authorities.snapshotHash,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_device_grants_user_fk",
      columns: [t.userId],
      foreignColumns: [authUsers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_device_grants_employee_scope_fk",
      columns: [t.businessId, t.employeeId],
      foreignColumns: [employees.businessId, employees.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_device_grants_assignment_scope_fk",
      columns: [t.businessId, t.shiftId, t.employeeId, t.assignmentId],
      foreignColumns: [
        shiftAssignments.businessId,
        shiftAssignments.shiftId,
        shiftAssignments.employeeId,
        shiftAssignments.id,
      ],
    }).onDelete("restrict"),
    uniqueIndex("v2_device_grants_full_scope_key").on(
      t.businessId,
      t.shiftId,
      t.id,
      t.authorityId,
      t.authorityEpoch,
      t.snapshotId,
      t.snapshotHash,
      t.installationId,
    ),
    uniqueIndex("v2_device_grants_active_installation_key")
      .on(t.businessId, t.shiftId, t.authorityEpoch, t.installationId, t.role)
      .where(sql`${t.revokedAt} IS NULL`),
    check("v2_device_grants_role_check", sql`${t.role} IN ('cashier','prep')`),
    check(
      "v2_device_grants_validity_check",
      sql`${t.expiresAt} > ${t.issuedAt} AND ${t.expiresAt} <= ${t.issuedAt} + interval '24 hours'`,
    ),
    check(
      "v2_device_grants_capabilities_array",
      sql`jsonb_typeof(${t.allowedKinds}) = 'array' AND jsonb_array_length(${t.allowedKinds}) <= 12`,
    ),
    check(
      "v2_device_grants_authority_epoch_safe",
      sql`${t.authorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_device_grants_snapshot_hash_sha256",
      sql`${t.snapshotHash} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
).enableRLS();

export const v2Operations = pgTable(
  "v2_operations",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    authorityId: uuid("authority_id").notNull(),
    authorityEpoch: bigint("authority_epoch", { mode: "number" }).notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    installationId: uuid("installation_id").notNull(),
    grantId: uuid("grant_id").notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    kind: text("kind").notNull(),
    canonicalDigest: text("canonical_digest").notNull(),
    envelope: jsonb("envelope").notNull(),
    receipt: jsonb("receipt").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("v2_operations_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_operations_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_operations_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_operations_authority_scope_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.authorityId,
        t.authorityEpoch,
        t.snapshotId,
        t.snapshotHash,
      ],
      foreignColumns: [
        v2Authorities.businessId,
        v2Authorities.shiftId,
        v2Authorities.id,
        v2Authorities.authorityEpoch,
        v2Authorities.snapshotId,
        v2Authorities.snapshotHash,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_operations_grant_scope_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.grantId,
        t.authorityId,
        t.authorityEpoch,
        t.snapshotId,
        t.snapshotHash,
        t.installationId,
      ],
      foreignColumns: [
        v2DeviceGrants.businessId,
        v2DeviceGrants.shiftId,
        v2DeviceGrants.id,
        v2DeviceGrants.authorityId,
        v2DeviceGrants.authorityEpoch,
        v2DeviceGrants.snapshotId,
        v2DeviceGrants.snapshotHash,
        v2DeviceGrants.installationId,
      ],
    }).onDelete("restrict"),
    uniqueIndex("v2_operations_sequence_key").on(
      t.businessId,
      t.shiftId,
      t.authorityEpoch,
      t.sequence,
    ),
    uniqueIndex("v2_operations_scope_key").on(
      t.businessId,
      t.shiftId,
      t.authorityEpoch,
      t.snapshotId,
      t.id,
      t.sequence,
    ),
    uniqueIndex("v2_operations_effect_scope_key").on(
      t.businessId,
      t.shiftId,
      t.id,
      t.sequence,
    ),
    uniqueIndex("v2_operations_command_scope_key").on(
      t.businessId,
      t.shiftId,
      t.authorityEpoch,
      t.snapshotId,
      t.id,
    ),
    check(
      "v2_operations_kind_check",
      sql`${t.kind} IN ('OPEN_SHIFT','SALE','REFUND','COMPLIMENTARY','REMAKE','RESTOCK','WASTE','ADJUST_STOCK','RETURN_UNPREPARED','PREP_TRANSITION','CASH_ADJUSTMENT','CLOSE_SHIFT')`,
    ),
    check(
      "v2_operations_envelope_object",
      sql`jsonb_typeof(${t.envelope}) = 'object'`,
    ),
    check(
      "v2_operations_receipt_object",
      sql`jsonb_typeof(${t.receipt}) = 'object'`,
    ),
    check(
      "v2_operations_authority_epoch_safe",
      sql`${t.authorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_operations_snapshot_hash_sha256",
      sql`${t.snapshotHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "v2_operations_sequence_safe",
      sql`${t.sequence} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_operations_canonical_digest_sha256",
      sql`${t.canonicalDigest} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
).enableRLS();

export const v2IngestIncidents = pgTable(
  "v2_ingest_incidents",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    submittedBy: uuid("submitted_by").notNull(),
    operationId: uuid("operation_id"),
    commandId: uuid("command_id"),
    authorityEpoch: bigint("authority_epoch", { mode: "number" }),
    sequence: bigint("sequence", { mode: "number" }),
    canonicalDigest: text("canonical_digest"),
    category: text("category").notNull(),
    evidence: jsonb("evidence").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by"),
    resolutionReason: text("resolution_reason"),
  },
  (t) => [
    uniqueIndex("v2_ingest_incidents_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_ingest_incidents_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_ingest_incidents_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    check(
      "v2_ingest_incidents_evidence_object",
      sql`jsonb_typeof(${t.evidence}) = 'object'`,
    ),
    index("v2_ingest_incidents_shift_time_idx").on(
      t.businessId,
      t.shiftId,
      t.receivedAt,
    ),
    check(
      "v2_ingest_incidents_evidence_bound",
      sql`octet_length(${t.evidence}::text) <= 1048576`,
    ),
    check(
      "v2_ingest_incidents_authority_epoch_safe",
      sql`${t.authorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_ingest_incidents_sequence_safe",
      sql`${t.sequence} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_ingest_incidents_canonical_digest_sha256",
      sql`${t.canonicalDigest} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
).enableRLS();

export const v2PrepCommands = pgTable(
  "v2_prep_commands",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    authorityId: uuid("authority_id").notNull(),
    authorityEpoch: bigint("authority_epoch", { mode: "number" }).notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    installationId: uuid("installation_id").notNull(),
    grantId: uuid("grant_id").notNull(),
    saleId: uuid("sale_id").notNull(),
    action: text("action").notNull(),
    canonicalDigest: text("canonical_digest").notNull(),
    command: jsonb("command").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    appliedOperationId: uuid("applied_operation_id"),
  },
  (t) => [
    uniqueIndex("v2_prep_commands_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_prep_commands_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_prep_commands_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_prep_commands_authority_scope_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.authorityId,
        t.authorityEpoch,
        t.snapshotId,
        t.snapshotHash,
      ],
      foreignColumns: [
        v2Authorities.businessId,
        v2Authorities.shiftId,
        v2Authorities.id,
        v2Authorities.authorityEpoch,
        v2Authorities.snapshotId,
        v2Authorities.snapshotHash,
      ],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_prep_commands_grant_scope_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.grantId,
        t.authorityId,
        t.authorityEpoch,
        t.snapshotId,
        t.snapshotHash,
        t.installationId,
      ],
      foreignColumns: [
        v2DeviceGrants.businessId,
        v2DeviceGrants.shiftId,
        v2DeviceGrants.id,
        v2DeviceGrants.authorityId,
        v2DeviceGrants.authorityEpoch,
        v2DeviceGrants.snapshotId,
        v2DeviceGrants.snapshotHash,
        v2DeviceGrants.installationId,
      ],
    }).onDelete("restrict"),
    check(
      "v2_prep_commands_command_object",
      sql`jsonb_typeof(${t.command}) = 'object'`,
    ),
    check(
      "v2_prep_commands_action_check",
      sql`${t.action} IN ('making','done','unprepared-return')`,
    ),
    uniqueIndex("v2_prep_commands_applied_operation_key").on(
      t.businessId,
      t.appliedOperationId,
    ),
    foreignKey({
      name: "v2_prep_commands_applied_operation_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.authorityEpoch,
        t.snapshotId,
        t.appliedOperationId,
      ],
      foreignColumns: [
        v2Operations.businessId,
        v2Operations.shiftId,
        v2Operations.authorityEpoch,
        v2Operations.snapshotId,
        v2Operations.id,
      ],
    }).onDelete("restrict"),
    check(
      "v2_prep_commands_authority_epoch_safe",
      sql`${t.authorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_prep_commands_snapshot_hash_sha256",
      sql`${t.snapshotHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "v2_prep_commands_canonical_digest_sha256",
      sql`${t.canonicalDigest} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
).enableRLS();

export const v2CountSeals = pgTable(
  "v2_count_seals",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    authorityEpoch: bigint("authority_epoch", { mode: "number" }).notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    kind: text("kind").notNull(),
    counts: jsonb("counts").notNull(),
    cashMinor: bigint("cash_minor", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("v2_count_seals_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_count_seals_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_count_seals_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    uniqueIndex("v2_count_seals_operation_key").on(t.businessId, t.operationId),
    foreignKey({
      name: "v2_count_seals_operation_scope_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.authorityEpoch,
        t.snapshotId,
        t.operationId,
        t.sequence,
      ],
      foreignColumns: [
        v2Operations.businessId,
        v2Operations.shiftId,
        v2Operations.authorityEpoch,
        v2Operations.snapshotId,
        v2Operations.id,
        v2Operations.sequence,
      ],
    }).onDelete("restrict"),
    uniqueIndex("v2_count_seals_seal_key").on(
      t.businessId,
      t.shiftId,
      t.authorityEpoch,
      t.kind,
    ),
    check(
      "v2_count_seals_kind_check",
      sql`${t.kind} IN ('opening','closing') AND (${t.kind} <> 'opening' OR ${t.cashMinor} IS NOT NULL)`,
    ),
    check(
      "v2_count_seals_counts_array",
      sql`jsonb_typeof(${t.counts}) = 'array' AND jsonb_array_length(${t.counts}) <= 500`,
    ),
    check(
      "v2_count_seals_authority_epoch_safe",
      sql`${t.authorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_count_seals_sequence_safe",
      sql`${t.sequence} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_count_seals_cash_minor_safe",
      sql`${t.cashMinor} BETWEEN 0 AND 9007199254740991`,
    ),
  ],
).enableRLS();

export const v2CloseManifests = pgTable(
  "v2_close_manifests",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    authorityEpoch: bigint("authority_epoch", { mode: "number" }).notNull(),
    snapshotId: uuid("snapshot_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    lastFinancialSequence: bigint("last_financial_sequence", {
      mode: "number",
    }).notNull(),
    journalDigest: text("journal_digest").notNull(),
    manifest: jsonb("manifest").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("v2_close_manifests_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_close_manifests_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_close_manifests_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    check(
      "v2_close_manifests_manifest_object",
      sql`jsonb_typeof(${t.manifest}) = 'object'`,
    ),
    uniqueIndex("v2_close_manifests_operation_key").on(
      t.businessId,
      t.operationId,
    ),
    foreignKey({
      name: "v2_close_manifests_operation_scope_fk",
      columns: [
        t.businessId,
        t.shiftId,
        t.authorityEpoch,
        t.snapshotId,
        t.operationId,
        t.sequence,
      ],
      foreignColumns: [
        v2Operations.businessId,
        v2Operations.shiftId,
        v2Operations.authorityEpoch,
        v2Operations.snapshotId,
        v2Operations.id,
        v2Operations.sequence,
      ],
    }).onDelete("restrict"),
    uniqueIndex("v2_close_manifests_one_close_key").on(
      t.businessId,
      t.shiftId,
      t.authorityEpoch,
    ),
    check(
      "v2_close_manifests_authority_epoch_safe",
      sql`${t.authorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_close_manifests_sequence_safe",
      sql`${t.sequence} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_close_manifests_last_financial_sequence_safe",
      sql`${t.lastFinancialSequence} BETWEEN 0 AND 9007199254740991`,
    ),
    check(
      "v2_close_manifests_journal_digest_sha256",
      sql`${t.journalDigest} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
).enableRLS();

export const v2RecoveryImports = pgTable(
  "v2_recovery_imports",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    packageId: uuid("package_id").notNull(),
    packageDigest: text("package_digest").notNull(),
    importedBy: uuid("imported_by").notNull(),
    authorizedBy: uuid("authorized_by").notNull(),
    authorizationReason: text("authorization_reason").notNull(),
    sourceAuthorityEpoch: bigint("source_authority_epoch", {
      mode: "number",
    }).notNull(),
    manifestId: uuid("manifest_id"),
    result: jsonb("result").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("v2_recovery_imports_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_recovery_imports_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_recovery_imports_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    check(
      "v2_recovery_imports_result_object",
      sql`jsonb_typeof(${t.result}) = 'object'`,
    ),
    uniqueIndex("v2_recovery_imports_package_key").on(
      t.businessId,
      t.packageId,
    ),
    foreignKey({
      name: "v2_recovery_imports_importer_fk",
      columns: [t.importedBy],
      foreignColumns: [authUsers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_recovery_imports_authorizer_fk",
      columns: [t.authorizedBy],
      foreignColumns: [authUsers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_recovery_imports_manifest_fk",
      columns: [t.businessId, t.manifestId],
      foreignColumns: [v2CloseManifests.businessId, v2CloseManifests.id],
    }).onDelete("restrict"),
    check(
      "v2_recovery_imports_package_digest_sha256",
      sql`${t.packageDigest} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "v2_recovery_imports_source_authority_epoch_safe",
      sql`${t.sourceAuthorityEpoch} BETWEEN 1 AND 9007199254740991`,
    ),
  ],
).enableRLS();

export const v2Effects = pgTable(
  "v2_effects",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id").notNull(),
    shiftId: uuid("shift_id").notNull(),
    operationId: uuid("operation_id").notNull(),
    sequence: bigint("sequence", { mode: "number" }).notNull(),
    stockDeltaAtoms: jsonb("stock_delta_atoms").notNull(),
    cashDeltaMinor: bigint("cash_delta_minor", { mode: "number" }).notNull(),
    grossSalesDeltaMinor: bigint("gross_sales_delta_minor", {
      mode: "number",
    }).notNull(),
    discountsDeltaMinor: bigint("discounts_delta_minor", {
      mode: "number",
    }).notNull(),
    refundsDeltaMinor: bigint("refunds_delta_minor", {
      mode: "number",
    }).notNull(),
    manualDigitalDeltaMinor: bigint("manual_digital_delta_minor", {
      mode: "number",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("v2_effects_business_id_key").on(t.businessId, t.id),
    foreignKey({
      name: "v2_effects_business_fk",
      columns: [t.businessId],
      foreignColumns: [businesses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "v2_effects_shift_scope_fk",
      columns: [t.businessId, t.shiftId],
      foreignColumns: [shifts.businessId, shifts.id],
    }).onDelete("restrict"),
    check(
      "v2_effects_stockDeltaAtoms_object",
      sql`jsonb_typeof(${t.stockDeltaAtoms}) = 'object'`,
    ),
    uniqueIndex("v2_effects_operation_key").on(t.businessId, t.operationId),
    foreignKey({
      name: "v2_effects_operation_fk",
      columns: [t.businessId, t.shiftId, t.operationId, t.sequence],
      foreignColumns: [
        v2Operations.businessId,
        v2Operations.shiftId,
        v2Operations.id,
        v2Operations.sequence,
      ],
    }).onDelete("restrict"),
    check(
      "v2_effects_sequence_safe",
      sql`${t.sequence} BETWEEN 1 AND 9007199254740991`,
    ),
    check(
      "v2_effects_cash_delta_minor_safe",
      sql`${t.cashDeltaMinor} BETWEEN -9007199254740991 AND 9007199254740991`,
    ),
    check(
      "v2_effects_gross_sales_delta_minor_safe",
      sql`${t.grossSalesDeltaMinor} BETWEEN -9007199254740991 AND 9007199254740991`,
    ),
    check(
      "v2_effects_discounts_delta_minor_safe",
      sql`${t.discountsDeltaMinor} BETWEEN -9007199254740991 AND 9007199254740991`,
    ),
    check(
      "v2_effects_refunds_delta_minor_safe",
      sql`${t.refundsDeltaMinor} BETWEEN -9007199254740991 AND 9007199254740991`,
    ),
    check(
      "v2_effects_manual_digital_delta_minor_safe",
      sql`${t.manualDigitalDeltaMinor} BETWEEN -9007199254740991 AND 9007199254740991`,
    ),
  ],
).enableRLS();
