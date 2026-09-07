# EP14 — Owner live dashboard with honest freshness and reconciliation

**Implementation prerequisites:** EP06, EP13

**Agent owner:** Owner web agent + data/security QA

**Proposed file ownership:** apps/web owner shift overview/detail, authorized summary services and realtime subscription adapter. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Show owners useful received shift data without implying knowledge of unreceived offline activity.

## Execution slices

### EP14.1 — independently reviewable slice
Build a focused shift dashboard for staff/readiness, opening counts, received sales/tenders, order progress, expected stock, waste and eventual closing status. Keep advanced analytics out of the pilot.

### EP14.2 — independently reviewable slice
Query committed server summaries/revisions. Use Realtime as an invalidation signal; re-fetch on initial load, subscription recovery, foreground return and bounded periodic reconciliation. Clean up subscriptions and discard stale response races.

### EP14.3 — independently reviewable slice
Show last-contact/last-received time, revision/completeness, stale/offline state, and media/review state separately. Do not display invented unsynced sale counts or label a partial closing manifest Final.

### EP14.4 — independently reviewable slice
Add tenant/role protection, time-zone handling and user-readable errors. A prepared/packing shift with no sales is a real state, not a broken empty dashboard.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP14-T01 | I/W/S | Drop all realtime notifications while the backend receives sales. | Refresh/reconciliation converges to the committed total without needing a new sale event. |
| EP14-T02 | W/I | Disconnect the cashier from the backend and continue selling locally. | Owner shows last confirmed totals and their age; unseen sales are neither guessed nor represented as zero. |
| EP14-T03 | I/W | Return an older summary response after a newer one. | UI keeps the newer accepted revision and avoids double-counting. |
| EP14-T04 | I/W | Receive a closing manifest while an earlier sequence is missing. | Summary is incomplete/provisional, not fully received or reviewed. |
| EP14-T05 | W | Sales are current but a proof upload is pending. | Financial freshness and attachment review are shown independently. |
| EP14-T06 | S | Use tenant B/staff identity to subscribe/query tenant A owner summaries. | Unauthorized reads/subscriptions are rejected. |
| EP14-T07 | S | Measure healthy foreground propagation over at least 100 operations. | Report p95/max/sample size against proposed owner-update target. |

## Completion gate

Authoritative query/reconciliation and stale-state tests pass; hosted latency is measured, not assumed from websocket presence.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Fallback to bounded authorized polling if realtime fails; retain the server query/receipt model and never replace values with client guesses.
