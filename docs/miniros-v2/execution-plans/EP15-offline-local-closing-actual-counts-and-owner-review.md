# EP15 — Offline local closing, actual counts and owner review

**Implementation prerequisites:** EP11, EP12

**Agent owner:** Mobile closeout/domain agent + independent financial QA

**Proposed file ownership:** apps/mobile closing/count screens, shared close reducers, server manifest/review services and owner summary integration. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Finish the working day without internet while preserving the difference between calculated, counted, received and reviewed data.

## Execution slices

### EP15.1 — independently reviewable slice
Implement closing draft with calculated totals, tender reconciliation, opening float/cash adjustments and expected stock. Staff records actual cash and optional/configured actual inventory counts; uncounted lines stay explicitly unverified.

### EP15.2 — independently reviewable slice
Resolve open prep orders by explicit completion/cancellation/manual disposition. Store any unresolved uncertainty as a review issue; do not erase it or force automatic stock return. Prevent new ordinary sales once local close commits.

### EP15.3 — independently reviewable slice
Atomically seal a closing manifest with final financial sequence/digest, expected balances, count statuses and declared attachment state. Save/reopen locally without requiring network or media completion.

### EP15.4 — independently reviewable slice
Implement backend fully-received verification and owner review/correction as separate states/events. Owner cannot silently edit the original staff evidence or finalize a sequence gap. Equipment return check may be optional reuse of checklist, not a mandatory new scope.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP15-T01 | I/D | Close the complete golden shift while both network paths are unavailable. | Local summary persists: gross 67,000, refunds 15,000, net 52,000, expected cash 240,000 minor units. |
| EP15-T02 | I/W | Count cash as 239,000 and cups as 92; leave another stock line uncounted. | Cash variance -1,000, cups variance -1, uncounted line unverified; expected counts remain unchanged. |
| EP15-T03 | I | Kill during closing commit and retry the same close command. | One complete closed state or recoverable draft; no half-closed shift or duplicate closeout. |
| EP15-T04 | I | Submit a close manifest before all earlier operations/attachments arrive. | Local closed state remains; server receipt completeness and owner review remain distinct. |
| EP15-T05 | I | Attempt new sale, direct opening-count edit or destructive owner correction after close. | Rejected or routed to an explicit audited correction/recovery revision. |
| EP15-T06 | I/D | Close with an order marked Making on disconnected prep. | Staff explicitly resolves/discloses disposition; reconnect does not silently prepare it twice. |
| EP15-T07 | I | Late duplicate sale/refund upload arrives after fully received closure. | Original receipt is returned and the sealed totals do not change. |

## Completion gate

G4 closeout subgate: fixed oracle, count variance, offline restart and sequence completeness tests pass.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Keep sealed closeouts immutable; rollback UI/server code only with compatible manifest readers and preserved outstanding evidence.
