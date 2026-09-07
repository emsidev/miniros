# EP08 — Departure checklist with missing-item handling

**Implementation prerequisites:** EP07

**Agent owner:** Mobile workflow agent + UX/security QA

**Proposed file ownership:** apps/mobile packing screens, existing shared checklist reducer and local persistence adapters. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Give staff a quick, durable pre-departure check without turning equipment into consumption inventory.

## Execution slices

### EP08.1 — independently reviewable slice
Render the snapshotted checklist grouped into Equipment, Hygiene and Booth Supplies or configured categories. Show required counts/presence, progress, missing items and one clear departure action.

### EP08.2 — independently reviewable slice
Save each answer locally with actor/time/template version. The cashier is the canonical editor; prep sees a replica when connected. Do not add multi-writer checklist conflict machinery to the pilot.

### EP08.3 — independently reviewable slice
Enforce critical-item rules and separately scoped exceptions. A permitted cashier exception needs a reason and visible flag; a requirement needing owner-only approval stays unresolved offline unless a valid preauthorization exists.

### EP08.4 — independently reviewable slice
Preserve completed/missing answers through navigation, app restart and peer reconnect. The departure event records checklist completion/exception evidence, not stock deductions.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP08-T01 | W/I | Check heater, gloves and utensils as packed. | Progress updates and persists; stock and financial ledgers do not change. |
| EP08-T02 | W/I | Leave a critical item missing and try to depart. | Blocked with a specific resolution; there is no hidden automatic override. |
| EP08-T03 | I | Attempt an exception without the required permission or reason. | Rejected locally and on server replay; valid exceptions retain actor/reason. |
| EP08-T04 | I/D | Interrupt/reopen during packing, then reconnect prep. | Committed answers restore and replicate once; no reset to an empty template. |
| EP08-T05 | W | Use a long categorized checklist on a small phone. | Missing/unchecked filters, accessible labels and progress make unresolved items easy to find. |
| EP08-T06 | I | Owner edits the checklist while staff is offline. | The issued version remains valid and its evidence references that version. |

## Completion gate

Checklist usability, persistence and permission tests pass; departure is auditable without inventory side effects.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Keep the original template/answers versioned; reverting UI code does not erase packing evidence.
