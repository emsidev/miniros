# EP10 — Cashier checkout and durable order creation

**Implementation prerequisites:** EP09, EP04

**Agent owner:** Mobile cashier agent + domain/security QA

**Proposed file ownership:** apps/mobile cashier/cart/payment/receipt screens and existing pure command handlers. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Make the busy-booth order path fast and correct with local persistence independent of either network.

## Execution slices

### EP10.1 — independently reviewable slice
Implement product/category search, modifiers, quantity changes, cart totals and unavailable-item handling from the frozen snapshot. Preserve supported existing tender/discount behavior without broadening scope.

### EP10.2 — independently reviewable slice
Implement cash with change, manual digital confirmation and existing split-tender rules. Capture required proof metadata locally using the separate media mechanism; do not wait for upload. External payment verification is not implied.

### EP10.3 — independently reviewable slice
Create sale, tender declarations, recipe/packaging effects, receipt, peer/cloud delivery references in one local transaction with a stable checkout intent ID. Disable accidental repeat action during commit while retaining idempotent retries.

### EP10.4 — independently reviewable slice
Clear the cart only after commit, render a recoverable saved receipt, and independently show prep/cloud progress. Disk failure preserves the draft; network failure does not reject an otherwise valid local sale.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP10-T01 | I/W | Sell two synthetic Ube Matchas for 30,000 minor units; receive 50,000 cash. | Change 20,000, retained cash 30,000, and two recipes/packaging consumed once. |
| EP10-T02 | I/D | Disable both networks and confirm a valid sale. | Local receipt and inventory commit succeed; peer/cloud are honestly pending. |
| EP10-T03 | I | Double-tap, restart after commit-before-render, and retry checkout. | One order, one receipt and one stock/tender effect. |
| EP10-T04 | I | Fail one stock/tender/outbox write. | Everything rolls back; original cart remains actionable and no success receipt appears. |
| EP10-T05 | U/I | Use insufficient stock, invalid modifier, stale price injection or unbalanced split tender. | Command fails with an actionable reason and no partial effects. |
| EP10-T06 | W/I | Record a manual digital tender while proof upload is unavailable. | Tender is staff-confirmed, not gateway-verified; later financial records remain eligible to upload. |
| EP10-T07 | W | Run the common three-item order with modifiers on target screens. | No unnecessary administrative navigation, clipped totals or keyboard-obscured confirm action. |

## Completion gate

Local checkout correctness and golden tender tests pass; no saved state depends on Supabase or prep availability.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Flag the new cashier per new shift; never switch an already-open legacy shift into a different journal implementation.
