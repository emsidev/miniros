# EP13 — Independent cloud synchronization, media retry and auth recovery

**Implementation prerequisites:** EP05, EP07, EP10, EP11, EP12

**Agent owner:** Backend/mobile sync agent + independent failure/security QA

**Proposed file ownership:** apps/mobile sync scheduler, existing server replay/native API, media jobs and regression tests for the legacy web sync path. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Make cloud delivery recoverable and non-blocking while separating small financial records from slow/failed attachments.

## Execution slices

### EP13.1 — independently reviewable slice
Implement durable financial uploads over the authorized native path: stable batch/operation IDs, ordered per-shift replay, committed receipts, bounded batch sizes, timeouts/backoff/jitter and foreground/reconnect/manual triggers. Reachability is not inferred solely from the internet icon.

### EP13.2 — independently reviewable slice
Implement media upload/linking as an independent job queue with size/type limits, checksums, retry and receipt verification. Preserve the required-photo review barrier but never place it in the path for subsequent financial records. Fix the legacy blocking behavior only with its regression test.

### EP13.3 — independently reviewable slice
Handle same-account cloud token refresh, ordinary expiry, revocation, invalid schema, permanent business conflicts and transient service outages differently. Preserve pending local data and quarantine conflicting evidence. One failing shift/attachment must not hold unrelated uploads.

### EP13.4 — independently reviewable slice
Expose precise local/peer/cloud/media statuses and last receipts. Reconcile after lost responses/restarts. Avoid a second overlapping sync engine; any proposal to add one requires an ADR and replacement boundary.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP13-T01 | I/S | Fail/slow a payment photo after sale A; queue sale B and closing data. | B and eligible financial records reach the backend; photo remains separately pending. |
| EP13-T02 | I/S | Drop server response after commit and repeat the batch. | Original receipts return and totals/stock remain unchanged. |
| EP13-T03 | I/D | Backend unavailable or captive portal with network icon on. | Cashier/prep continue locally and upload retries do not hot-loop or block UI. |
| EP13-T04 | I/S | Expire cloud credentials during a prepared open shift, then reauthenticate the same account. | Local sales/closing and retained queues survive; successful reauth resumes delivery once. |
| EP13-T05 | I/S | Revoke access or switch to another account with pending work. | Policy and data isolation hold; no silent deletion or unauthorized upload. |
| EP13-T06 | I | Insert a permanent conflict into one shift and a failed attachment alongside valid work. | That shift shows its blocking gap; unrelated permitted records/jobs continue. |
| EP13-T07 | I/D | Kill/reboot during a batch and resume after connectivity returns. | All committed operations reconcile with the golden oracle and independent receipts. |

## Completion gate

G3 delivery subgate: financial/photo separation, idempotency and real auth/storage recovery pass; silent credential bypass is prohibited.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Preserve receipts/outboxes across scheduler rollback. Server supports old client envelopes while the new uploader is feature-flagged.
