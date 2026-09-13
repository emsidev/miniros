# EP05 backend implementation report

Source: local `miniros` checkout, branch `dev`, baseline
`0056f316cf811f10f943d56c4c987b1642844938`, working changes on 2026-09-07.
No remote project lookup, git synchronization, hosted mutation, deployment or
commit was performed. This report covers the backend worker's assigned paths;
the lead owns contracts, Drizzle schema, migration, shared legacy guards and
integration/status evidence.

Implementation is code complete for the EP05 persistence/authentication/ingestion
foundation. New native authority creation is default-off. Physical and hosted
acceptance remain blocked; this is not release acceptance or completed EP07
automatic enrollment/preparation.

## Changed paths and API

Server implementation: `apps/web/src/server/services/native-v2/`.
Native POST routes: `apps/web/src/app/api/native/v2/`.
Worker verification: `apps/web/src/test/native-v2/`.

All native routes use live Supabase `getUser(bearer)` with public project
credentials, a server-only branded identity and persisted tenant/assignment
authorization. Cookie-only authentication does not authorize these endpoints.
Every response uses `Cache-Control: no-store`; requests are bounded to 262,144
UTF-8 bytes. Errors never echo bearer tokens, database SQL or secrets. Existing
web Origin/CSRF protection remains intact.

| POST route                     | Behavior                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/native/v2/snapshots`     | Owner/admin stores an immutable verified v2 snapshot and exclusive epoch-1 cashier authority. Exact repeat returns the existing authority; changed snapshot/installation is rejected. This is a persistence API, not a manual packaging requirement for owners; automatic preparation belongs to EP07. |
| `/api/native/v2/grants`        | Owner/admin issues an Ed25519 public-key installation grant to a currently assigned permitted employee. Cashier requires operator assignment and POS permission; prep requires employee assignment and production permission. Maximum TTL 24 hours; no stock-adjustment capability is issued.          |
| `/api/native/v2/grants/revoke` | Owner/admin revokes future effects with a required audited reason; existing original receipts remain evidence.                                                                                                                                                                                         |
| `/api/native/v2/ingest`        | Authenticates one signed cashier operation, applies frozen EP03 semantics and stores one original receipt transactionally. Each request has its own shift transaction.                                                                                                                                 |
| `/api/native/v2/prep`          | Stores an independently signed prep command and original acknowledgment. It changes no financial/order state. Commands may arrive before cashier cloud catch-up; cashier canonical operations consume exact verified command evidence.                                                                 |
| `/api/native/v2/recovery`      | Same-business owner/admin imports bounded original signed evidence with an audited reason and duplicate-safe package identity. It does not waive signature, grant validity, ordering, scope or closed-state checks. EP16 scanning/UI/full recovery workflow is outside this implementation.            |

The internal factory is `createNativeV2Service(database, { now?, fault? })` in
`service.ts`; methods are `registerSnapshot`, `issueGrant`, `revokeGrant`,
`ingest`, `submitPrep` and `importRecovery`. The fault hook is an internal test
dependency, never a request parameter. Recovery package digest is SHA-256 of
`canonicalV2({ businessId, shiftId, packageId, operations })`; the separate owner
reason is recorded in the audit/import record.

## Persistence and security behavior

The lead's additive migration
`supabase/migrations/20260907143003_native_v2_persistence.sql` supplies ten v2
tables with RLS and strict scoped foreign keys. New raw tables are not exposed
to public, anon, authenticated or service-role Data API access and are not in the
Realtime publication. Direct database access retains the existing server's
trusted application boundary. The legacy v1 parser/journal and money/count
semantics remain unchanged; v2 never invokes legacy sale/opening services or
deducts central inventory on opening.

Native ingestion locks the existing shift and then its authority, revalidates
current business membership and assignment, verifies the exact persisted grant
scope, recalculates the canonical SHA-256 digest, and verifies Ed25519 over its
UTF-8 text using the grant's validated SPKI public key. A digest alone grants no
authority. Installation identity/key changes are rejected within an authority
epoch; no automatic failover or key replacement is implemented.

The frozen EP03 reducer provides the immutable replacement projection. One
database transaction contains stock/cash/sales/discount/refund effect deltas,
the signed original operation, original cloud receipt, count seals, close
manifest, prep-command consumption and contiguous high-water mark. The deferred
effects-to-operation foreign key permits a real injected fault after effects
but before receipt insertion; rollback leaves none of those effects committed.

Identical retries return the saved original receipt and timestamp, including
after grant expiry/revocation when current same-tenant installation identity
still verifies. Changed IDs/digests, missing sequences, invalid signatures,
expired/revoked grants, invalid assignment and unsupported versions do not
advance completeness. Strictly parsed signed envelopes are retained in separate
own-scope incidents; invalid/oversized unknown JSON retains safe IDs and a
fingerprint without copying arbitrary secret-bearing fields. Foreign tenants
cannot create incidents in the victim's scope. One shift's rejection does not
abort another shift's request.

Prep financial writes are rejected. Prep payload booleans are insufficient:
the cashier references a stored signed command matching business, shift,
snapshot, epoch, installation, sale and action. Command consumption is atomic
and unique. Previously accepted prep evidence remains valid historical evidence
after later grant expiry/revocation. No prep endpoint returns a plaintext
financial journal or cashier projection. An encrypted prep financial mirror
and native peer transport integration belong to later plans.

`ADJUST_STOCK` is excluded until a dedicated verified owner-approval adapter
exists. A fabricated approval UUID cannot authorize stock changes. Actual
closing cash `null`, uncounted stock and pending attachment IDs retain their
meaning; missing media does not prevent the committed canonical close.

## Rollout and preservation

`MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED=1` is required to create a new authority.
The default is off. Disabling the flag affects new shifts only: existing exact
snapshot/authority retrieval, grant policy, ingestion and original receipts
remain available. No local journal is deleted, no planned closing time stops
local work, and upload authorization errors instruct preservation/retry.

The lead added reciprocal legacy guards under the shared shift lock so neither
legacy nor v2 preparation can reserve a shift already owned by the other
runtime. Existing v1 original receipts remain retrievable. No hosted migration
or native distribution was authorized or performed.

## Worker validation

Real engine: PostgreSQL 18.0, aarch64 macOS, Apple clang 17, isolated
`/tmp/miniros-ep05-postgres/data`, loopback `127.0.0.1:55432`, database
`miniros_ep00_disposable`. Official source checksum, standalone build commands,
synthetic Auth/Storage bootstrap and the earlier 16 migrations are documented in
`EP05_BACKEND_PREPARATION.md`; the lead applied the v2 migration to this task-owned
database. Fixtures use random synthetic UUIDs and remove only their own rows.
The native database suite rejects a missing or non-disposable database target
instead of silently skipping PostgreSQL cases.

```sh
env -u DATABASE_URL SHIFT_TEST_DATABASE_URL=postgres://127.0.0.1:55432/miniros_ep00_disposable corepack pnpm --filter @miniros/web exec vitest run src/test/native-v2/backend.db.test.ts src/test/native-v2/http.test.ts
corepack pnpm --filter @miniros/web typecheck
corepack pnpm --filter @miniros/web exec eslint src/server/services/native-v2 src/app/api/native/v2 src/test/native-v2 --ext .ts
corepack pnpm exec prettier --check apps/web/src/server/services/native-v2 apps/web/src/app/api/native/v2 apps/web/src/test/native-v2
git diff --check -- apps/web/src/server/services/native-v2 apps/web/src/app/api/native/v2 apps/web/src/test/native-v2
```

The focused suite contains 12 actual-PostgreSQL tests and two HTTP adapter tests.
It covers dropped responses/original receipts, gaps/conflicts/unsupported
versions, role/install/epoch/snapshot/signature/assignment failures,
expiry/revocation, fault rollback, two concurrently held backend PIDs, trusted
prep and false proof rejection, close preservation, owner issuance/import,
cross-tenant/raw-grant/private-storage/publication boundaries, new-authority
rollout gating and independent shift/command queues. Supabase `getUser` alone is
mocked in-process for these synthetic users; Ed25519, schema checks, services,
reducer and PostgreSQL are real. Hosted Auth HTTP is not claimed.

Initial test-only corrections: a PostgreSQL catalog query needed `relkind='r'`
to exclude indexes; the member fixture must use the actual `disabled` enum;
incident assertions now select by category rather than assume unordered SQL
row order. A broad Vitest filename substring briefly included the independent
reviewer's in-progress suite before its rollout flag fixture was updated; final
worker commands name the two owned files explicitly.

Final worker suite: **14 passed, 0 failed, 0 skipped**. A subsequent run added the
independent reviewer's three legacy/PostgreSQL boundary regressions after the
concurrency fix below: **17 passed across three files, 0 failed, 0 skipped**,
0.918 seconds. Exact final command:

```sh
env -u DATABASE_URL SHIFT_TEST_DATABASE_URL=postgres://127.0.0.1:55432/miniros_ep00_disposable MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED=1 corepack pnpm --filter @miniros/web exec vitest run src/test/native-v2/backend.db.test.ts src/test/native-v2/http.test.ts src/test/native-v2-review/legacy-review.test.ts
```

The actual concurrent ingestion test held PostgreSQL backend PIDs **62405 and
62403** simultaneously, asserted they differed and verified identical original
receipts with one effect. The retained output is
`/tmp/miniros-ep05-postgres/ep05-backend-test.log`. Scoped ESLint, Prettier and
diff whitespace checks passed. The lead separately owns full golden
SQLite-to-PostgreSQL replay, overall v1 compatibility after migration, migration
review and repository-wide gates.

Independent review found and reproduced a P1 native-versus-legacy reservation
race: a legacy `REPEATABLE READ` transaction waiting on the shift row could retain
a snapshot from before the native authority existed. With the lead's approval,
new native authority creation now also updates the locked shift's `updatedAt`,
creating a new PostgreSQL row version. A waiting legacy transaction receives
serialization failure rather than claiming from stale data. The independent
regression now passes; legacy isolation was not weakened. Full independent
review acceptance is recorded by the reviewer/lead.

## Remaining acceptance gates

Hosted Supabase Auth/RLS/Storage/Realtime checks need an explicitly authorized
disposable staging project and credentials. Physical Android/iOS native builds,
two-phone peer integration, automatic enrollment/snapshot delivery, encrypted
prep mirroring, full QR recovery and staff pilot are not established by these
tests. These are recorded plan/device/staging gates, not a passing substitute.
No production release or user-data migration is claimed.
