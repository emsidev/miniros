# EP04 — Crash-safe native SQLite ledger and independent queues

**Implementation prerequisites:** EP03

**Agent owner:** Mobile persistence agent + domain/QA reviewer

**Proposed file ownership:** apps/mobile storage adapters and migrations, shared storage interfaces, native storage tests. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Make locally saved mean durable and recoverable, including opening drafts and sales during outages.

## Execution slices

### EP04.1 — independently reviewable slice
Add a native SQLite adapter with reviewed connection/transaction configuration, foreign keys, migration versioning and typed repositories. Verify the installed Expo/SQLite API rather than copying unchecked latest examples. Serialize conflicting writers and initialize each connection consistently.

### EP04.2 — independently reviewable slice
Persist identity-scoped snapshots, packing/count drafts, immutable operations, projections, peer/cloud outboxes, receipts and attachment jobs. A sale transaction writes all required effects and both delivery references atomically.

### EP04.3 — independently reviewable slice
Implement readback readiness, durable draft autosave, stable command IDs, process restart recovery, bounded in-memory state and error reporting. Do not clear a cart/draft before successful commit. Avoid browser/localStorage as the new critical ledger.

### EP04.4 — independently reviewable slice
Add fault injection at transaction boundaries, disk/write failures and migrations, plus safe diagnostic export. Never drop/recreate the database as an error-recovery shortcut.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP04-T01 | I/D | Kill/relaunch immediately before and after a sale commit. | The sale is absent or fully present, with matching stock/outboxes and recoverable cart status. |
| EP04-T02 | I | Fail writing the journal, stock projection, tender, or outbox inside one transaction. | All effects roll back; no saved receipt appears. |
| EP04-T03 | I | Double-submit checkout through competing async handlers/connections. | One operation and one financial/stock effect; database constraints enforce uniqueness. |
| EP04-T04 | I/D | Autosave counts, force a write error, terminate and reopen. | Last committed values survive; unsaved input/error is not falsely labeled saved. |
| EP04-T05 | I | Run old database fixtures through each local migration and interrupt migration. | No lost pending records; recovery/read-only safe failure is documented. |
| EP04-T06 | I | Switch accounts/businesses or lose visible auth while records remain. | Other identities cannot read retained operational data; no deletion of pending evidence. |
| EP04-T07 | I | Attempt an orphan child row through every connection/transaction helper. | Foreign-key and ownership constraints actually apply, not merely to the initial connection. |

## Completion gate

G2 storage subgate: actual SQLite integration and restart tests pass; physical cold-start evidence is tracked separately.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Use additive local migrations with backups where appropriate; preserve old files read-only on migration failure instead of resetting.
