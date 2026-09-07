# EP07 — Staff enrollment, automatic snapshots, and departure preflight

**Implementation prerequisites:** EP02, EP04, EP05, EP06

**Agent owner:** Mobile enrollment agent + backend/security reviewer

**Proposed file ownership:** apps/mobile join/readiness flow, shared snapshot contract and authorized snapshot/grant services. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Let staff join a scheduled shift and automatically receive everything needed for offline operation, without owner-built packages.

## Execution slices

### EP07.1 — independently reviewable slice
Implement authenticated assigned-shift selection and QR-assisted joining. Issue/bind a scoped device grant and automatically construct the versioned catalog/recipes/checklist/shift snapshot. Enroll one cashier authority and the authorized prep role.

### EP07.2 — independently reviewable slice
Atomically save and read back snapshot data, assets required for operation and permitted role state. Pin the same snapshot on both phones. Product images may be optional; essential menu text/prices/recipes cannot be lazy cloud dependencies.

### EP07.3 — independently reviewable slice
Implement readiness checks for local storage, native build/protocol compatibility, permissions, intended local connection and a test order round-trip. Distinguish Ready locally from Owner reachable. Provide explicit one-device emergency mode without pretending prep is connected.

### EP07.4 — independently reviewable slice
Handle repeated join, stale invites, interrupted preparation, catalog errors and pre-open refresh. Offline startup uses the saved capability/data, not a fresh mandatory remote login. Record planned versus actual times separately.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP07-T01 | I/D | Prepare online, terminate both apps, disable WAN and cold launch. | The correct shift/menu/checklist opens with permitted local actions and no network login dependency. |
| EP07-T02 | I | Repeat join or reopen a preparation after a lost response. | One shift reservation/cashier authority, no duplicate opening allocation. |
| EP07-T03 | I | Interrupt snapshot save or supply a missing essential recipe/asset. | Readiness remains false; previous complete state is preserved and retry is safe. |
| EP07-T04 | I/D | Join a foreign/expired/incompatible shift QR or unauthorized third cashier. | Reject with useful explanation; no cross-business or second-authority access. |
| EP07-T05 | I | Refresh before opening, then change the owner catalog after opening. | Draft compatibility is handled explicitly; active snapshot is not silently changed. |
| EP07-T06 | D | Permissions/local link fail but cloud works, then WAN fails but peer works. | UI reports the two channels independently and only claims the readiness actually established. |

## Completion gate

Prepared offline cold launch passes. Native peer readiness still depends on G1 physical evidence; do not hide an online-only pairing requirement.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Retain complete old snapshots/grants until safe replacement; never overwrite an active shift on repeated enrollment.
