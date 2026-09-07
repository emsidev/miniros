# EP05 — Backend persistence, native authorization, and safe ingestion

**Implementation prerequisites:** EP03

**Agent owner:** Owner/backend agent + independent security/database QA

**Proposed file ownership:** packages/db, packages/contracts, existing server services/API adapters and new ordered migrations; integrator owns migration numbering. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Extend the current validated replay services for native devices and the revised workflow without weakening tenant or identity isolation.

## Execution slices

### EP05.1 — independently reviewable slice
Inspect schema and RLS in the actual checkout. Add only missing entities/columns/indexes for versioned checklist/snapshot data, device grants, sequence receipts, count seals, close manifests and recovery imports. Use expand/contract migrations and preserve historic semantics.

### EP05.2 — independently reviewable slice
Implement native authentication as an adapter around existing domain services. Validate business, assignment, role, origin installation, authority epoch, snapshot and permitted operation. Keep web CSRF/origin protections; never embed server secrets in the client.

### EP05.3 — independently reviewable slice
Implement transactional idempotent ingest with a durable original receipt and contiguous high-water mark. Store gaps/conflicts/rejected evidence separately and isolate failing shifts. Validate replay against the frozen schema/recipe version, not current catalog values.

### EP05.4 — independently reviewable slice
Add RLS/grants/storage/channel tests, concurrent-connection PostgreSQL tests and old-client compatibility tests. Define reviewed offline-grant expiry/revocation and owner-import authorization policies before issuance.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP05-T01 | I/S | Commit an operation but drop the HTTP response; retry. | The original receipt returns; journal, sales, stock and cash apply once. |
| EP05-T02 | I | Submit sequence 3 before 2, or the same ID with a changed digest. | No false completeness; gap/conflict is visible and no overwritten original evidence. |
| EP05-T03 | I/S | Use tenant B credentials against tenant A rows, views, storage, channels and mutation routes. | Access is denied throughout; hidden UI is not the boundary. |
| EP05-T04 | I/S | Use prep/expired/revoked/wrong-installation privileges for a cashier mutation. | Policy is enforced and local evidence is preserved/quarantined under the explicit contract. |
| EP05-T05 | I | Fail after business effects but before writing the sync journal/receipt. | The whole database transaction rolls back. |
| EP05-T06 | I | Replay old supported client envelopes after additive migrations. | They remain ingestible with historic pricing/count semantics; unsupported versions fail non-destructively. |
| EP05-T07 | I | Race duplicate ingests on separate real PostgreSQL connections. | One committed effect and consistent original receipt, not just a PGlite single-connection success. |

## Completion gate

Security review plus real PostgreSQL tests pass; hosted auth/RLS/Storage checks remain explicit S gates.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

No hosted push without authorization. Keep new columns/tables compatible with old code; roll application code back without erasing received records.
