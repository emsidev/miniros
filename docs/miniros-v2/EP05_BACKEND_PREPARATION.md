# EP05 backend preparation

Preparation only, before the EP03 interface freeze. Inspected the local `dev`
checkout at `0056f316cf811f10f943d56c4c987b1642844938` on 2026-09-07. No
EP05 application code, migrations, manifests, historic journals, or remote
resources were changed during this inspection. The lead owns final names and
contracts; the proposals below are not an accepted wire format.

## Existing boundaries to preserve

- The implemented replay lives in `apps/web/src/server/services/offline-sync.ts`
  and `/api/offline/*`; `apps/api/src/server.ts` currently implements only health
  and workflow preview. Extend the existing server services instead of starting a
  second ingestion service in Hono.
- `offline_shift_sessions` locks an owning session and an existing shift. Its
  partial unique index already prevents two active legacy owners. It contains a
  frozen v1 snapshot and contiguous acknowledged sequence.
- `offline_sync_actions` uniquely identifies `(business_id, client_action_id)`
  and `(session_id, sequence)`. Legacy success saves business effects and journal
  in one database transaction and returns the saved business result on retry.
  Existing failure rows can subsequently become success rows; preserve this v1
  behavior and do not treat those rows as immutable v2 receipts.
- Existing `PreparedOperationContext` passes the transaction and frozen v1
  snapshot to business services. Each service nevertheless calls the
  cookie-dependent `requireActiveBusiness` again. Native authentication therefore
  needs an internal verified-actor adapter, not forged cookies or an untrusted
  `userId` parameter.
- `/api/offline/sync` explicitly requires matching `Origin`; keep that boundary.
  Public Supabase Auth is cookie-aware, and relational persistence uses Drizzle.
- Sensitive session/pilot tables already enable RLS and revoke all Data API
  privileges from `anon` and `authenticated`. Legacy journal reads are scoped by
  RLS; writes are server-only. Payment proofs use a private bucket with exact
  linked-file read policies. Do not restore direct browser/native object writes.

## Additive persistence proposal

Use the existing replay service and current operational tables. New v2 immutable
evidence can be stored in sidecar tables because its identity and semantics
cannot be represented safely by the legacy mutable journal enum. Final table
names and migration numbering belong to the lead.

| Entity                      | Required data and constraints                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen workflow snapshot    | UUID; business and shift; schema/protocol/recipe versions; canonical hash; exact snapshot JSON; checklist template ID/version and resolved inventory units within that JSON; creation time. Unique business+snapshot ID; no update from ingestion. Existing v1 JSON remains unchanged.                                                                                |
| Native authority            | Business+shift key; existing session link if reused; current cashier installation and authority epoch; frozen snapshot ID/hash; contiguous committed high-water mark; workflow projection. Lock the existing shift first, then this row. One cashier for an epoch; no silent failover or second active legacy reservation.                                            |
| Device grant                | UUID; business/shift; authenticated user/employee; assignment identity; role (`cashier`/`prep`); installation ID; epoch; snapshot ID/hash; permitted operations; pinned device public key/key ID if EP03 adopts signatures; issuance/expiry/revocation times and reasons. Bind grant to current persisted authority, not client assertions.                           |
| Immutable operation receipt | UUID; business/shift/epoch; stable operation ID; origin installation; sequence; canonical digest; exact envelope; original cloud receipt and business result; server receipt time. Unique business+operation ID and business+shift+epoch+sequence. Retries return the exact saved receipt, including original time/outcome. Never update the original for a conflict. |
| Ingest incident             | UUID; business/shift; candidate operation ID/sequence/digest; error category and bounded original evidence; server observation time; authenticated submitter; resolution metadata. Gaps, conflicts and rejected payloads do not occupy accepted sequence slots or advance completeness. Grant/token material must not be copied into evidence.                        |
| Opening/closing count seal  | UUID; business/shift/epoch; original operation ID; snapshot reference; seal kind; exact unit-aware count answers and cash; digest; sequence. One opening seal per epoch; later correction is a new audited operation, never an opening overwrite.                                                                                                                     |
| Close manifest              | UUID; business/shift/epoch; final sequence; journal digest; opening/closing seal refs; attachment declarations; exact manifest; original receipt. Final received requires all committed sequences plus matching manifest, while media remains separate.                                                                                                               |
| Recovery import             | UUID; business/shift; package ID/digest; owner authorization identity/time/reason; source grant/epoch; result with accepted/duplicate/rejected references. Unique business+package ID and conflict evidence for changed digest. No grant bypass merely because bytes arrived by owner import.                                                                         |

Add same-business composite foreign keys for all new references. Where existing
tables lack a composite candidate key, add a unique `(business_id, id)` index
without rewriting rows. Use positive/bounded sequence and epoch checks, digest
shape checks, enum/checks for statuses, and reasonable JSON/request size limits.
Give every operational row a business ID. Avoid `ON DELETE CASCADE` from an
ordinary shift change to immutable evidence. Enable RLS and revoke all public,
anon and authenticated privileges on the new internal tables; grant the existing
server role only what its services require. Do not publish snapshots/grants/raw
operations to Realtime; owner summaries need their own scoped server view later.

## Native API and ingestion proposal

1. A dedicated native `/api/native/v2/...` adapter validates a Bearer token with
   Supabase Auth `getUser(token)`, using the existing public project credentials.
   Never accept cookie-only authentication at the native endpoint. Validate body
   bounds and strict schema; no service key or installation secret is returned.
2. Resolve active business membership, active employee, current shift assignment,
   role permission, grant, installation key/signature, epoch and snapshot from
   persisted state. Extract this as a shared internal actor-resolution service
   usable by cookie-authenticated legacy adapters and native adapters.
3. Lock shift then authority/session in a single Drizzle transaction. Resolve an
   existing original receipt first after identity authorization. Identical retry
   returns that receipt; different digest/identity records a conflict separately.
4. Require the next sequence to equal high-water mark + 1. Out-of-order valid
   operations record gap evidence and return the missing sequence; they may be
   resubmitted when the predecessor commits. No inferred completeness from
   `max(sequence)` or timestamps.
5. Validate/reduce against the frozen schema and recipe version. Use the EP03
   reducer as the semantic source. Existing v1 service adapters continue using
   their v1 prepared snapshot. Unsupported versions produce bounded rejected
   evidence and no business effect.
6. Put the accepted operation, operational effects, seal/manifest effects, original
   receipt and high-water mark in the same transaction. A receipt-write fault
   after effects must roll back everything. A deterministic domain rejection may
   use a savepoint so a separate incident commits without partial effects.
7. Keep each shift ingestion independent; one invalid shift cannot abort an
   unrelated shift's batch. Media uploads and owner-review state are separate
   from durable local close and journal acceptance.

## Proposed policy requiring independent review before issuance

Online issuance requires current active membership, current assignment, proper
role permission, matched immutable snapshot and exclusive cashier authority.
Grants should have an explicit bounded validity window (proposed maximum 24
hours); no renewable capability is embedded in QR/package data. The server checks
its own receive time and revocation state. Evidence from expired or revoked
grants is retained/quarantined for owner recovery instead of silently accepted or
deleted. A user-editable occurred-at time must not extend authority. Revocation
does not rewrite already committed receipts. Owner imports require an active
owner/admin of the same business and an explicit audited recovery decision; they
must still verify original identity/digest, historical grant and duplicate safety.
The lead may choose a stricter expiry policy; hosted issuance remains an S gate.

## Real PostgreSQL preparation

No `postgres`, `psql`, Docker, or installed Homebrew PostgreSQL was available.
Apple clang/make were present. A standalone PostgreSQL 18.0 source tarball and
its SHA-256 sidecar were downloaded from the official PostgreSQL distribution
host into `/tmp/miniros-ep05-postgres`; checksum validation passed. The package
is a local integration dependency, not a project-source remote lookup.

```sh
cd /tmp/miniros-ep05-postgres
shasum -a 256 -c postgresql-18.0.tar.bz2.sha256
tar -xjf postgresql-18.0.tar.bz2
cd postgresql-18.0
./configure --prefix=/tmp/miniros-ep05-postgres/install --without-icu --without-readline --without-zlib
make -j 4
make install
```

Build and install completed successfully. No existing database or global
installation is used. Source archive SHA-256:
`0d5b903b1e5fe361bca7aa9507519933773eb34266b1357c4e7780fdee6d6078`.
The official `.sha256` comparison returned `postgresql-18.0.tar.bz2: OK`.
The
repository guard permits only
`postgres://127.0.0.1:55432/miniros_ep00_disposable` (or equivalent protocol),
with no query/hash override. Check that port is free before starting a task-owned
data directory, bind only 127.0.0.1, record `data_directory`/server address/port,
and verify two simultaneously held clients report different backend PIDs.

The dedicated port was unused before startup. Provisioned using:

```sh
/tmp/miniros-ep05-postgres/install/bin/initdb -D /tmp/miniros-ep05-postgres/data --no-locale --encoding=UTF8 --auth=trust -U emsi
/tmp/miniros-ep05-postgres/install/bin/pg_ctl -D /tmp/miniros-ep05-postgres/data -l /tmp/miniros-ep05-postgres/server.log -o '-h 127.0.0.1 -p 55432 -k /tmp/miniros-ep05-postgres/socket -c wal_level=logical' -w start
/tmp/miniros-ep05-postgres/install/bin/createdb -h 127.0.0.1 -p 55432 -U emsi miniros_ep00_disposable
```

SQL identity check returned PostgreSQL 18.0 / aarch64 Darwin / Apple clang 17,
database `miniros_ep00_disposable`, server address `127.0.0.1`, port `55432`,
and `data_directory=/tmp/miniros-ep05-postgres/data`. Two simultaneously held
psql transactions returned distinct backend PIDs `55225` and `55226`.
`/tmp/miniros-ep05-postgres/connection-proof.txt` records this observation.

Applied the minimal synthetic Auth/Storage bootstrap plus all 16 current ordered
SQL migrations, including the real PostgreSQL publication migration, with
`psql -X -v ON_ERROR_STOP=1 -f ...`. No migrations were skipped or changed.
The exact bootstrap, migration list and command output are retained as
`/tmp/miniros-ep05-postgres/bootstrap.sql`, `applied-migrations.txt`, and
`migrations.log`. Hosted HTTP/Auth/Storage/Realtime checks remain S gates.
The existing PostgreSQL-aware schedule/admin workflow suites verify this
environment before v2 changes:

```sh
env -u DATABASE_URL -u MINIROS_PREVIEW_URL SHIFT_TEST_DATABASE_URL=postgres://127.0.0.1:55432/miniros_ep00_disposable corepack pnpm --filter @miniros/web exec vitest run src/server/services/schedule.db.test.ts src/server/services/admin-shift-workflows.db.test.ts
```

Result: 2 files passed, 21 tests passed, 0 failed, 0 skipped; 1.10 seconds.
This includes existing PostgreSQL concurrency cases and is baseline evidence,
not the future EP05-T07 ingestion race.

The server remains available for the authorized EP05 checks; stop only this
task-owned cluster after final integration using:

```sh
/tmp/miniros-ep05-postgres/install/bin/pg_ctl -D /tmp/miniros-ep05-postgres/data -m fast -w stop
```

## Required EP05 evidence

- T01: lost response and retry return deep-equal original receipt; one effect.
- T02: sequence gap and changed-digest conflict preserve original evidence and
  do not falsely advance high-water mark.
- T03: different tenant denied through service and SQL; no direct new-table
  grants, private linked Storage reads, publication/channel gate recorded.
- T04: prep, expired, revoked, wrong installation, wrong epoch/snapshot denied;
  validated own-tenant evidence is quarantined without leaking foreign rows.
- T05: fault after effect but before receipt rolls back receipt, journal, stock,
  sale, cash and authority advancement.
- T06: original supported v1 envelopes and frozen prices/count behavior survive
  the complete additive migration chain; unsupported versions are non-destructive.
- T07: race duplicate ingests on independently held PostgreSQL connections;
  prove different PIDs, one committed effect and identical original receipts.

Independent database/security review must inspect final contracts and SQL. This
preparatory report alone is neither EP05 implementation nor acceptance evidence.

## Migration draft against the EP03 types

Updated after inspection of `packages/domain/src/v2/{types,schema,core}.ts`.
These are exact recommended Drizzle property names and SQL types for the lead's
single-writer `packages/db/src/schema/v2.ts`. They are a draft, not executed SQL.
Use snake_case equivalents for SQL columns/table names. `UUID` means `uuid()`;
`int` means `integer()`; `safeint` means `bigint({ mode: "number" })` plus an SQL
safe-integer bound; `time` means `timestamp({ withTimezone: true })`; JSON means
`jsonb()` validated at the service boundary. Primary/foreign IDs are lowercase
UUIDs in the strict contract. The ID column is the primary key unless stated.
All fields are non-null unless explicitly nullable.

| Export / SQL name                           | Exact recommended fields                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v2Snapshots` / `v2_snapshots`              | `id UUID`, `businessId UUID`, `shiftId UUID`, `schemaVersion int default 2`, `version safeint`, `catalogVersion text`, `recipeVersion text`, `costingVersion text`, `checklistId UUID`, `checklistVersion safeint`, `hash text`, `snapshot JSON` (exact `V2Snapshot`), `createdBy UUID`, `createdAt time default now()`                                                                                                                                                           |
| `v2Authorities` / `v2_authorities`          | `id UUID`, `businessId UUID`, `shiftId UUID`, `snapshotId UUID`, `snapshotHash text`, `cashierInstallationId UUID`, `authorityEpoch safeint`, `lastSequence safeint default 0`, `state text default 'unopened'`, `projection JSON` (exact `V2Projection`), `createdAt time default now()`, `updatedAt time default now()`                                                                                                                                                         |
| `v2DeviceGrants` / `v2_device_grants`       | `id UUID`, `businessId UUID`, `shiftId UUID`, `authorityId UUID`, `userId UUID`, `employeeId UUID`, `assignmentId UUID`, `installationId UUID`, `authorityEpoch safeint`, `snapshotId UUID`, `snapshotHash text`, `role text`, `allowedKinds JSON` (strict `V2Kind[]`, empty for prep), `grantSpki text` (validated Ed25519 SPKI PEM), `issuedBy UUID`, `issuedAt time`, `expiresAt time`, `revokedAt time nullable`, `revokedBy UUID nullable`, `revocationReason text nullable` |
| `v2Operations` / `v2_operations`            | `id UUID` (the canonical operationId), `businessId UUID`, `shiftId UUID`, `authorityId UUID`, `authorityEpoch safeint`, `snapshotId UUID`, `snapshotHash text`, `installationId UUID`, `grantId UUID`, `sequence safeint`, `kind text`, `canonicalDigest text`, `envelope JSON` (exact signed `V2Operation`), `receipt JSON` (exact original `V2Receipt`), `receivedAt time`                                                                                                      |
| `v2IngestIncidents` / `v2_ingest_incidents` | `id UUID`, `businessId UUID`, `shiftId UUID`, `submittedBy UUID`, `operationId UUID nullable`, `commandId UUID nullable`, `authorityEpoch safeint nullable`, `sequence safeint nullable`, `canonicalDigest text nullable`, `category text`, `evidence JSON` (bounded envelope/command evidence, no bearer token), `receivedAt time`, `resolvedAt time nullable`, `resolvedBy UUID nullable`, `resolutionReason text nullable`                                                     |
| `v2PrepCommands` / `v2_prep_commands`       | `id UUID` (commandId), `businessId UUID`, `shiftId UUID`, `authorityId UUID`, `authorityEpoch safeint`, `snapshotId UUID`, `snapshotHash text`, `installationId UUID`, `grantId UUID`, `saleId UUID`, `action text`, `canonicalDigest text`, `command JSON` (exact signed `V2PrepCommand`), `receivedAt time`, `appliedOperationId UUID nullable`                                                                                                                                 |
| `v2CountSeals` / `v2_count_seals`           | `id UUID`, `businessId UUID`, `shiftId UUID`, `authorityEpoch safeint`, `snapshotId UUID`, `operationId UUID`, `sequence safeint`, `kind text` ('opening'/'closing'), `counts JSON` (exact `V2Count[]`), `cashMinor safeint nullable` (closing null means uncounted; opening must be non-null), `createdAt time`                                                                                                                                                                  |
| `v2CloseManifests` / `v2_close_manifests`   | `id UUID` (payload.manifestId), `businessId UUID`, `shiftId UUID`, `authorityEpoch safeint`, `snapshotId UUID`, `operationId UUID`, `sequence safeint`, `lastFinancialSequence safeint`, `journalDigest text`, `manifest JSON` (exact `V2Payloads['CLOSE_SHIFT']` including counts, actual cash, pending attachment IDs and manual resolutions), `receivedAt time`                                                                                                                |
| `v2RecoveryImports` / `v2_recovery_imports` | `id UUID`, `businessId UUID`, `shiftId UUID`, `packageId UUID`, `packageDigest text`, `importedBy UUID`, `authorizedBy UUID`, `authorizationReason text`, `sourceAuthorityEpoch safeint`, `manifestId UUID nullable`, `result JSON`, `receivedAt time`                                                                                                                                                                                                                            |
| `v2Effects` / `v2_effects`                  | `id UUID`, `businessId UUID`, `shiftId UUID`, `operationId UUID`, `sequence safeint`, `stockDeltaAtoms JSON` (item UUID to signed safe integer), `cashDeltaMinor safeint`, `grossSalesDeltaMinor safeint`, `refundsDeltaMinor safeint`, `manualDigitalDeltaMinor safeint`, `createdAt time`                                                                                                                                                                                       |

`v2Effects` is append-only operation-effect evidence computed from the before/after
EP03 reducer result, not a second reducer or the source of prices. A stock delta
may be negative, while stock balances cannot. One row per accepted operation
provides an inspectable sale/refund/cash/stock effect without invoking the legacy
central inventory semantics. The original envelope is the replay source of truth;
the projection is a cached result that can be rebuilt from frozen snapshots and
accepted operations.

Required candidate keys, indexes and checks:

- Add `(business_id, id)` unique indexes on existing `shifts`, `employees` and
  `shift_assignments` for new same-business foreign keys. New tables referenced
  across rows likewise expose `(business_id, id)` as a unique key.
- Snapshots: unique `(business_id, shift_id, version)` and unique
  `(business_id, shift_id, id, hash)`. Authorities reference the latter tuple.
- Authorities: unique `(business_id, shift_id)` for the supported single
  authority; unique `(business_id, shift_id, id, authority_epoch)` and exact
  `(business_id, shift_id, authority_epoch, snapshot_id, snapshot_hash)` candidate
  key for grant/operation binding. No automated epoch rollover/failover service.
- Grants reference exact authority+epoch+snapshot and same-business
  employee/assignment. An ordinary FK cannot prove the assignment's employee and
  shift match all fields, so add the appropriate composite assignment key or
  validate these rows together under the shift transaction. A unique active
  grant per `(business_id, shift_id, authority_epoch, installation_id, role)`
  prevents accidental duplicate capabilities; renewal/revocation are explicit.
- Operations: unique `(business_id, shift_id, authority_epoch, sequence)` plus
  primary operation ID and business+ID candidate key. The foreign authority and
  snapshot columns bind the exact immutable scope. A service additionally
  compares stored digest, full canonical body, installation and grant identity.
- Prep commands: unique `(business_id, id)` and nullable-unique
  `(business_id, applied_operation_id)`; no canonical financial sequence field.
  Exact grant/authority/snapshot foreign keys. Accepted command rows cannot be
  rewritten; only their one-time applied-operation link can advance.
- Count seals: unique `(business_id, shift_id, authority_epoch, kind)` and unique
  `(business_id, operation_id)`. Snapshot and operation same-business FKs.
- Manifests: unique `(business_id, shift_id, authority_epoch)` and unique
  `(business_id, operation_id)`. Recovery package: unique
  `(business_id, package_id)`; changed package digest writes an incident.
- Effects: unique `(business_id, operation_id)` and FK to that operation;
  stock item references are validated against the frozen snapshot rather than
  mutable central inventory. The transaction writes effects and receipt together.
- Incidents: index `(business_id, shift_id, received_at)`, and optional lookup
  indexes for operation ID/command ID; never a unique sequence constraint.
- All snapshots/hashes and digests match `^[a-f0-9]{64}$`; versions/epochs are
  positive safe integers; accepted sequence is positive; high-water/financial
  sequence is nonnegative; money scalar bounds match contract. `expires_at >
issued_at` and proposed `expires_at <= issued_at + interval '24 hours'`.
- Snapshot schemaVersion is 2; authority state is unopened/open/closed; roles
  are cashier/prep; operation kind is the fixed v2 kind list; command actions are
  making/done/unprepared-return. New table RLS enabled; revoke public/anon/
  authenticated privileges. Keep all new raw tables out of Realtime publication.

The database schemas do not need to import domain runtime types; typed JSON
parsing and digest/signature verification belong in the server adapter. Expose
the Drizzle export from `packages/db/src/schema/index.ts` under lead ownership.

### Prep authentication and actor construction

Both native operation and prep-command HTTP routes require verified Bearer Auth
and live persisted membership/assignment/grant checks. Grant public keys are
trusted only after authenticated issuance. Verify Ed25519 with Node's standard
crypto API over the **UTF-8 text of canonicalDigest**, as fixed by the lead:

```ts
verify(
  null,
  Buffer.from(canonicalDigest, "utf8"),
  grantSpki,
  Buffer.from(signature, "base64"),
);
```

This follows structural parsing and SHA-256 recalculation of the canonical body.
The digest and signature have different roles. A valid prep signature permits
storage of the prep command, not direct financial journal writes. A cashier
PREP_TRANSITION/RETURN_UNPREPARED references a stored, independently verified prep
command matching sale ID, installation, action, business, shift, epoch and
snapshot. Populate `V2Actor.verifiedPrepCommands` only from that row and link its
consumption to the accepted operation in the same transaction. Repeated identical
submissions return the original command acknowledgment; changed digest remains a
separate incident. A previously accepted command remains historical evidence
after later grant expiry/revocation; accepting a new command still needs a live
grant. Server receive time bounds grant validity; client occurredAt does not.

### Additional approval boundary before grants include stock adjustment

`ADJUST_STOCK.approvalId` must be verified, not merely structurally present. Either
exclude `ADJUST_STOCK` from issued capabilities until a dedicated authorization
adapter exists, or add `v2StockApprovals` with `id`, `businessId`, `shiftId`,
`authorityEpoch`, `snapshotId`, `itemId`, exact `deltaAtoms`, authenticated
`approvedBy`, `approvedAt`, bounded reason and nullable unique `appliedOperationId`.
Ingestion must match that exact scope/delta and consume the approval atomically.
Do not use an already applied legacy central-stock approval to authorize a v2
adjustment. Packing exception IDs similarly need verified owner authorization
when the departure workflow is implemented; drafts do not grant that authority.
