# EP04/EP05 migration and rollback notes

Root integrator owns these additive migrations. Source is the local `dev` checkout at `0056f316cf811f10f943d56c4c987b1642844938` plus this diff. No hosted migration command was run.

## Native SQLite

`apps/mobile/src/storage/v2/migrations.ts` exports ordered versions 1 and 2 for the isolated `miniros-v2-ledger.db` file. It does not open or migrate legacy Dexie or the EP02 synthetic file. Version 1 adds identity/shift scopes, frozen snapshots, projection cache, immutable journal/tenders, revisioned drafts, independent peer/cloud outboxes and original receipts. Version 2 adds independent attachment jobs. Parent/child foreign keys include the scope; immutable evidence has update/delete rejection triggers.

Every connection explicitly verifies foreign_keys=1, journal_mode=WAL and synchronous=FULL before use. Writers acquire BEGIN IMMEDIATE. The installed Expo SQLite implementation opens a new connection for its exclusive callback; the adapter therefore opens and configures its own `useNewConnection: true` connection before beginning a transaction. No connection can rely on another connection's PRAGMAs.

All missing migration statements and PRAGMA user_version are committed in one transaction. Failure rolls the migration back. A database from a newer app is rejected without changing its records. Preserve the file and its WAL/SHM companions on failure; do not delete, reset, downgrade it in place, or copy an active main file without SQLite's backup coordination. Diagnostic export is scoped and bounded; it is not a database backup. Physical native process termination and platform backup/restore remain separate D gates.

To roll application code back, stop opening the v2 file and keep it for a compatible reader/recovery build. A downgraded app must not mark the retained queue synchronized. No destructive down migration is supplied.

## PostgreSQL

`supabase/migrations/20260907143003_native_v2_persistence.sql` adds ten `v2_*` tables and candidate indexes on the existing employee/shift/assignment keys. It preserves every historic column, migration and v1 journal. The matching code-first Drizzle schema is `packages/db/src/schema/v2.ts`, exported through the existing schema index; generated migration metadata is retained.

The generated SQL was reviewed and ordered so candidate unique indexes exist before composite foreign keys. The `v2_effects_operation_fk` is explicitly DEFERRABLE INITIALLY DEFERRED, permitting an effects-before-receipt transaction while requiring the matching immutable journal at commit. Drizzle's schema builder does not represent that deferral; retain it if a future migration recreates the constraint. Effects bind business, shift, operation and sequence. Prep consumption and seals/manifests bind their exact journal scope.

All ten raw tables enable RLS and revoke access from PUBLIC, anon, authenticated and service_role. No v2 table is added to Realtime, and no new public Storage bucket is introduced. Authorized server transactions are the only current mutation/readback interface. Existing web origin/CSRF checks are unchanged. Existing v1 services and the v2 service share the shift row lock and reject competing authority claims. New v2 authority creation also updates the locked shift row version: a legacy REPEATABLE READ transaction that began before the native claim must receive a serialization failure, rather than proceeding from a stale snapshot. Identical historical v1 receipts remain retrievable before the new-work exclusion guard.

Applied only to the verified task-owned PostgreSQL 18.0 cluster at `127.0.0.1:55432/miniros_ep00_disposable`:

```sh
/tmp/miniros-ep05-postgres/install/bin/psql -X -v ON_ERROR_STOP=1 \
  -h 127.0.0.1 -p 55432 -U emsi -d miniros_ep00_disposable \
  --single-transaction \
  -f supabase/migrations/20260907143003_native_v2_persistence.sql
```

Application succeeded; raw output is `evidence/ep05-migration.log`. Catalog inspection confirms RLS on all ten tables, denied anon/authenticated table access, and the deferred effects constraint. EP05_BACKEND_PREPARATION.md records the task-owned PostgreSQL build/bootstrap and source checksum. Hosted Supabase Auth/Data API/Storage/Realtime checks remain S gates; synthetic SQL Auth/Storage models do not prove hosted behavior.

Rollback means disabling new authority creation and using a compatible server build that retains the v1/v2 exclusion guards, while leaving received v2 snapshots, grants, operations, incidents, receipts and imports intact. An unpatched pre-EP05 server is not a safe rollback while v2 authorities exist; it does not understand their reservation. Preserve v2 shift reservations so a v1 device cannot claim an unfinished v2 journal. Do not drop the additive tables or delete incidents to make old code appear compatible. Any future hosted expand migration requires separate authorization, backup planning and hosted acceptance. `pnpm db:migrate` targets hosted Supabase and was not used.
