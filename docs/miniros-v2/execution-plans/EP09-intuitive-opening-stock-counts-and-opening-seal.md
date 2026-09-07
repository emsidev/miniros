# EP09 — Intuitive opening-stock counts and opening seal

**Implementation prerequisites:** EP08, EP03

**Agent owner:** Mobile inventory agent + domain/arithmetic QA

**Proposed file ownership:** apps/mobile count/review screens, unit-entry helpers, local opening-seal transaction and backend projection. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Staff records actual booth stock efficiently; the owner never has to allocate it in advance.

## Execution slices

### EP09.1 — independently reviewable slice
Build one searchable count view with category picker, progress, Uncounted filter and inline numeric/pack entry. Use the cached business inventory/catalog. Support Not brought and explicit bulk confirmation for irrelevant unresolved items.

### EP09.2 — independently reviewable slice
Implement conversions from configured packs plus partial quantities, autosave/readback, validation, notes and a review summary. Do not infer blank=zero, use arbitrary expression evaluation, or pull prior-shift counts as confirmed values.

### EP09.3 — independently reviewable slice
Identify unresolved stock required by available menu products; staff may mark products unavailable, but cannot make missing recipes valid silently. Record opening float. All essential quantities/definitions must be explicit before opening.

### EP09.4 — independently reviewable slice
Seal opening counts, initial shift stock projection, float and shift-open event in one transaction. This initializes shift stock only; no synthetic purchase or automatic global-stock debit. Later changes become explicit movements.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP09-T01 | U/W | Enter 3 one-litre milk cartons plus 400 ml. | Opening quantity is exactly 3,400 ml; the inputs survive restart. |
| EP09-T02 | W/I | Leave a field blank, enter zero on another, and mark a third Not brought. | Three distinct states; no silent zero or false count-complete progress. |
| EP09-T03 | I | Try fractional pieces, invalid units, negatives, overflow or expression injection. | Validation rejects safely and leaves the last good draft intact. |
| EP09-T04 | I/D | Crash during opening seal, then retry the same command. | Either unopened or one complete opening; never doubled stock/float or partially open state. |
| EP09-T05 | I | Compare business warehouse totals before and after opening counts. | No purchase/manufactured quantity appears; any existing source movement remains separate and explicit. |
| EP09-T06 | I | Attempt to edit opening quantities after a sale. | Original counts remain immutable; staff is guided to an authorized adjustment. |
| EP09-T07 | W | Count a realistic catalog with categories/search/unresolved filters. | No horizontal overflow or navigation reset; every required line has a deliberate final state. |

## Completion gate

Opening fixture, restart/seal tests and category-count usability pass before checkout is enabled.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Never replace historic opening counts. Preserve drafts on validation/migration failures and keep the old workflow behind its legacy mode.
