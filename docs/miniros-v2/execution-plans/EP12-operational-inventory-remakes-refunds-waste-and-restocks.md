# EP12 — Operational inventory, remakes, refunds, waste and restocks

**Implementation prerequisites:** EP10, EP03

**Agent owner:** Domain/mobile inventory agent + independent arithmetic/permissions QA

**Proposed file ownership:** packages/domain adjustment handlers, apps/mobile quick actions, server replay projections and focused tests. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Keep expected stock useful through real booth exceptions without adding cumbersome administration or double-counting materials.

## Execution slices

### EP12.1 — independently reviewable slice
Add quick permitted actions for remake, complimentary/staff item, ingredient/packaging waste, actual restock and count correction. Record actor, reason, quantities and immutable link to any original sale. Prep may request actions, but the cashier owns financial/stock commits.

### EP12.2 — independently reviewable slice
Implement refunds and cancellations with tender limits and explicit physical disposition. Never return prepared materials automatically. Handle partial quantities only with an explicit item/portion accounting decision and resolved prep state.

### EP12.3 — independently reviewable slice
Integrate prepared-stock portions, recipe/modifier packaging, units and fixed-precision rounding. Avoid counting raw production and finished portions twice. Expose low/out-of-stock guidance without creating stock to bypass validation.

### EP12.4 — independently reviewable slice
Update local and cloud summaries from the same event semantics, retaining opening observations, adjustments and actual counts separately. Preserve existing approvals where required instead of bypassing them for convenience.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP12-T01 | U/I | Replay all golden sales, prepared refund, complimentary drink, remake, spill, restock and cookie sale. | Expected stock and cash match the fixed oracle exactly. |
| EP12-T02 | I | Refund the prepared Ube Matcha. | Cash decreases 15,000 minor units; ingredients/packaging are not returned. |
| EP12-T03 | I | Record one remake and one complimentary item, then repeat the requests. | Exactly one additional recipe per unique action and no additional paid revenue. |
| EP12-T04 | I | Waste 200 ml of milk and restock 1,000 ml. | Milk changes by those amounts once; actions remain distinct from opening quantities. |
| EP12-T05 | I | Attempt unauthorized adjustment, excessive refund or correction to sealed opening stock. | Rejected with preserved originals; any allowed correction is a new audited event. |
| EP12-T06 | U/I | Consume one cookie portion from a prepared tray. | Portion/topping/packaging decrease, raw production ingredients do not decrease again. |
| EP12-T07 | I | Oversell an item, then explicitly correct/restock and retry. | First command rolls back; the second valid sale succeeds without synthetic inventory. |

## Completion gate

Every exception has reviewed monetary and physical-stock semantics and passes local/server golden comparison.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Preserve immutable adjustment history. Correct an erroneous rule through an audited versioned fix, never rewriting historic consumption.
