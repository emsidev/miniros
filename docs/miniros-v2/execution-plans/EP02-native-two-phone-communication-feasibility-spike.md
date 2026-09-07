# EP02 — Native two-phone communication feasibility spike

**Implementation prerequisites:** EP01

**Agent owner:** Mobile/connectivity agent + independent protocol/security QA

**Proposed file ownership:** apps/mobile native module/transport spike and isolated tests; dependency/lockfile changes by integrator. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Prove the hardest physical requirement before committing to a production transport: durable two-way communication with no internet across supported phone pairs.

## Execution slices

### EP02.1 — independently reviewable slice
Inspect compatible current native APIs/libraries and app-store/build implications. Prototype one preferred transport behind a small interface: discover, authorize/pair, send, receive, acknowledge, reconnect, disconnect. Evaluate a fallback only when evidence requires it; do not add several transports by default.

### EP02.2 — independently reviewable slice
Build real Android/iOS development binaries, not Expo Go or web export. Send numbered test envelopes and persist a minimal receiver inbox before returning receipts. Authenticate the peer/session and verify the QR/short-code binding; no nearby auto-trust.

### EP02.3 — independently reviewable slice
Add a simulated fault transport for repeatable dropped, duplicated, reordered and delayed messages. Test permission/radio-denial UX, cancellation, background/resume and discovery cleanup. Separate transport delivery from application durable acknowledgement.

### EP02.4 — independently reviewable slice
Run the physical matrix and record measured limitations, native module maintenance/build compatibility, payload envelope and pairing recovery. Select the transport by ADR only when evidence supports it. Keep portable work progressing if hardware access is temporarily blocked.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP02-T01 | D | Pair each required phone combination without WAN or cloud access. | Exactly the authorized shift peer connects; order and status command round trips persist correctly. |
| EP02-T02 | I/D | Drop the receipt after the receiver persisted an envelope; resend it. | One stored logical operation, repeatable receipt, and no duplicate visual alert for the same delivered order. |
| EP02-T03 | D | Disable/restore a radio, background/lock a phone and reopen. | Pending data remains and resumes honestly; no false received badge or silent connection guarantee. |
| EP02-T04 | I/D | Send out-of-order, malformed, oversized and wrong-shift packets. | Inputs are bounded/rejected or buffered under protocol; unrelated shifts cannot join. |
| EP02-T05 | D | Deny camera/local-network/Bluetooth permissions and then grant them. | Clear actionable recovery; setup resumes without app reinstall or destructive reset. |
| EP02-T06 | D | Measure healthy foreground latency and reconnect with the test batch. | Report actual p95/max and payload limits against proposed targets; no simulator-only pass. |

## Completion gate

G1 requires actual device evidence and security review. A working simulator/mock supports code development only.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Keep the spike isolated behind the transport interface; replace a failed candidate without rewriting domain logic. No production deployment.
