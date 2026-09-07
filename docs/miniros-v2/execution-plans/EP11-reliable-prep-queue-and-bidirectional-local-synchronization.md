# EP11 — Reliable prep queue and bidirectional local synchronization

**Implementation prerequisites:** EP10, EP02

**Agent owner:** Mobile/connectivity agent + protocol/UX QA

**Proposed file ownership:** apps/mobile production peer adapter, prep screens, inbox/command outbox and shared order-transition handlers. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Turn the proven transport into a persistent kitchen/prep workflow that does not lose, duplicate or falsely acknowledge orders.

## Execution slices

### EP11.1 — independently reviewable slice
Connect the EP02 transport to durable cashier outbox and prep inbox. Receipt means the prep database committed the order, not merely that the transport sent bytes. Replicate order contents, modifiers, cancellations and relevant snapshot version.

### EP11.2 — independently reviewable slice
Implement New/Making/Done with large actions, optional sound/haptics, elapsed time and explicit undo/correction. Prep commands carry stable IDs and expected order revision; the cashier persists accepted changes before acknowledging.

### EP11.3 — independently reviewable slice
Implement ordered catch-up, receipts/high-water marks, duplicate suppression, bounded retries and reconnect. Keep financial writes on the cashier. Define manual direct-relay fallback and mark already-manually-prepared orders so reconnection does not request duplicate preparation.

### EP11.4 — independently reviewable slice
Implement the reviewed recovery-mirror boundary from EP01: operational data plus a secure, authorized redundancy mechanism without exposing extra financial privileges. Record the exact last replicated checkpoint and never auto-promote prep.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP11-T01 | I/D | Place several orders, disconnect prep, create more, reconnect. | Each order appears once with correct contents/order state; undelivered indicators clear only after durable receipts. |
| EP11-T02 | I | Lose acknowledgements for New, Start, Done and undo commands. | Retries do not duplicate cards, side effects or audible new-order notifications. |
| EP11-T03 | I | Deliver stale Start after accepted Done, or cancellation against stale preparation revision. | Invalid regression is rejected/reconciled; completed work is not silently reopened. |
| EP11-T04 | I/D | Complete an order via explicit manual fallback while prep is disconnected. | Reconnection presents the resolved state, not another new order to prepare. |
| EP11-T05 | D | Lock/background/kill/restart prep during a queue. | Queue and pending commands persist; UI states pauses/receipts truthfully. |
| EP11-T06 | I/S | Use prep credentials or readable local data to attempt financial mutations. | Role/device restrictions hold; any financial recovery mirror follows the approved privacy boundary. |
| EP11-T07 | D | Lose the cashier after only a partial replica exists. | Recovery reports the last known checkpoint and unknown gap; no automatic second cashier authority. |

## Completion gate

Production peer integration passes protocol and real-phone tests; no claim that a green cloud connection proves local delivery.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Keep a single-device queue/direct-relay option. Replace/revert transport adapter without deleting durable inbox/outbox history.
