# EP03 — Shared domain model, operation contracts, and golden arithmetic

**Implementation prerequisites:** EP01

**Agent owner:** Domain/data agent + independent arithmetic QA

**Proposed file ownership:** packages/domain, packages/contracts, fixtures and contract tests; shared edits serialized. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Establish deterministic money, stock and event semantics that local and cloud implementations share.

## Execution slices

### EP03.1 — independently reviewable slice
Map current schemas/reducers and extend them for templates, snapshots, packing answers, opening counts, authority/device identity, orders/prep commands and close manifests. Prefer existing types over parallel models. Version envelopes and define canonical serialization/digests.

### EP03.2 — independently reviewable slice
Implement integer minor-unit money, fixed-precision stock atoms, explicit pack conversions, recipe/modifier consumption, prepared-item boundaries and immutable shift snapshot references. Define idempotency, terminal states and sequence rules.

### EP03.3 — independently reviewable slice
Implement/refactor pure reducers for sales, refunds, remakes, complimentary usage, restocks, waste, cash adjustments and closing summaries. A refund is not an implicit inventory return. Reject unauthorized/invalid transitions before effects.

### EP03.4 — independently reviewable slice
Create automated fixtures from golden-shift.json and independently reviewed expected constants; add property tests with reproducible seeds and backwards-compatible old-envelope fixtures.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP03-T01 | U | Replay the golden scenario in original order. | Net sales 52,000 minor units; expected cash 240,000; exact stock matches the fixture. |
| EP03-T02 | U | Replay every operation twice and retry refund/remake commands. | Money, usage and counts remain unchanged after the first application. |
| EP03-T03 | U | Change the master recipe/price/pack conversion after snapshot creation. | Historical sale values and usage remain frozen. |
| EP03-T04 | U | Use fractional pieces, mixed dimensions, negative/NaN quantities or invalid tender sums. | Validation rejects them without partial financial or stock effects. |
| EP03-T05 | U | Sell a prepared cookie portion whose raw ingredients were consumed before the shift. | One portion and toppings/packaging are used, with no second raw-production deduction. |
| EP03-T06 | U | Refund a prepared drink and cancel an explicitly unprepared order. | Refund leaves consumed materials used; only explicit verified return changes stock. |
| EP03-T07 | U | Supply a cyclic recipe and duplicate ID with changed payload. | Both fail visibly; neither creates a balance or silently overwrites evidence. |

## Completion gate

Golden oracle and contract/property suites pass with independent review; contracts are versioned for the storage/backend agents.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Keep old contract ingestion compatible; do not reinterpret stored historic operations under new reducers.
