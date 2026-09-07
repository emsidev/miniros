# EP18 — Migration safety, observability, CI and release hardening

**Implementation prerequisites:** EP13, EP14, EP15, EP16

**Agent owner:** Lead/backend/release agent + independent security/reliability QA

**Proposed file ownership:** CI/configuration, additive migrations, diagnostics, legacy transition adapters and release documentation; integrator owns shared files. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Make the redesign safe to introduce without losing existing Miniros data or mistaking green placeholder checks for readiness.

## Execution slices

### EP18.1 — independently reviewable slice
Inventory old clients/open shifts/retained browser queues and design a new-shift-only rollout flag. Keep old ingestion/routes and immutable history compatible. Drain/sync or explicitly reconcile legacy shifts before changing their runtime; do not attempt direct browser-to-native DB access.

### EP18.2 — independently reviewable slice
Add structured redacted diagnostics for local commit failures, peer receipts/gaps, cloud rejection classes, queue depth/age, attachment status and revisions. Provide staff-readable recovery and owner support diagnostics without leaking tokens or payment content.

### EP18.3 — independently reviewable slice
Add truthful CI jobs for actual domain/integration/RLS/migration tests, web build, native Android/iOS builds and declared hosted/physical gates. Fail required zero-test/skipped-only jobs. Add protocol compatibility tests, dependency/license review and build version provenance.

### EP18.4 — independently reviewable slice
Rehearse additive migrations and application rollback on representative staged historical/queued data; prepare backup/export checks, phased rollout, incident runbook, retention policy, app-update boundaries and store/signing steps. Production application/publish commands require explicit approval.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP18-T01 | I/S | Migrate a staging fixture with old open/closed shifts and pending v1 operations. | Historical totals remain exact, old queues still ingest and new operations do not reinterpret old snapshots. |
| EP18-T02 | I/S | Roll application code back after new-schema writes. | Compatible reads/replay work or an explicit safe read-only recovery path preserves every record; no destructive down migration. |
| EP18-T03 | I | Run CI with a required suite executing zero tests or missing its promised environment. | The gate is failed/blocked, not green from echo/skip commands. |
| EP18-T04 | I/S | Scan built clients, logs, diagnostic exports, cached pages and QR payloads. | No service-role keys, reusable owner tokens, foreign business data or unencrypted restricted recovery content leak. |
| EP18-T05 | I/D | Trigger app/schema update with an open shift and pending data. | No mandatory destructive reload; operations remain readable/replayable and upgrade waits for a safe boundary. |
| EP18-T06 | S | Attempt a release/migration command without the approved target/authorization. | Safety guard blocks the action; test fixtures remain isolated. |
| EP18-T07 | I/S | Export/restore a recovery fixture and trace one order across all receipts. | Support can identify local/peer/cloud state without modifying the ledger or guessing missing work. |

## Completion gate

G4 hardening subgate: staged migration/rollback, real CI coverage, security review and redacted diagnostics accepted.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Feature flags affect new shifts. Roll back code compatibly, retain schema expansions/data, and leave unresolved old queues recoverable.
