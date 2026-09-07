# EP01 — Product contract, architecture decisions, and runnable UX skeleton

**Implementation prerequisites:** EP00

**Agent owner:** Lead + domain and UX/mobile agents; QA reviews

**Proposed file ownership:** docs/miniros-v2, shared workflow contracts and development-only UI route/screen skeletons; shared contracts serialized. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Convert requirements into a single state/ownership model and an interactive workflow skeleton before detailed UI work.

## Execution slices

### EP01.1 — independently reviewable slice
Adopt PRODUCT_AND_ARCHITECTURE.md and map every requirement to plans/tests. Write ADRs for native staff/owner web, authority, local/cloud/media separation, frozen snapshots, shift-only stock semantics, offline grants, privacy of recovery replicas and QR transfer.

### EP01.2 — independently reviewable slice
Define conceptual API/event contracts and transition tables without prematurely rebuilding every table. Map to existing types and identify protocol-version changes. Freeze the interface for parallel work.

### EP01.3 — independently reviewable slice
Build a development-only navigable skeleton for owner setup/schedule and staff Join → Pack → Count → Sell/Prep → Close. Include loading, missing-data, offline, validation and interrupted-save states; do not present mock success as implemented functionality.

### EP01.4 — independently reviewable slice
Define visual tokens and screen ownership using existing Miniros assets. Record product defaults such as one cashier, no silent overselling and planned times not locking an active shift.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP01-T01 | U | Enumerate workflow transitions and guarded actions. | Illegal skips, competing cashier claims, and editing sealed opening counts fail deterministically. |
| EP01-T02 | W | Navigate the owner schedule skeleton. | Required fields are date/time, venue/address and assignments only; business setup remains separate. |
| EP01-T03 | W | Navigate counting with empty, zero and Not brought examples. | Those states remain distinct and the unresolved count is visible. |
| EP01-T04 | Review | Trace each binding requirement to an EP/test. | Every requirement has an owner and a verification path; older owner-allocation assumptions are explicitly superseded. |
| EP01-T05 | Review | Inspect runtime choice and recovery ADRs. | No pure-PWA/mixed-phone claim or homegrown cryptographic design is accepted without evidence. |

## Completion gate

Contract review accepted; remaining technology risks are recorded as EP02 gates, not hidden as assumptions.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Feature-flag the skeleton; existing workflows remain usable. ADR changes require explicit rationale and updated dependent tests.
