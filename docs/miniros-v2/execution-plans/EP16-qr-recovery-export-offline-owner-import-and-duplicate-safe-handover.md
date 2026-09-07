# EP16 — QR recovery export, offline owner import and duplicate-safe handover

**Implementation prerequisites:** EP05, EP07, EP13, EP15

**Agent owner:** Mobile/owner recovery agent + independent security/protocol QA

**Proposed file ownership:** Native export/camera flow, deliberately cached owner recovery page/local import journal, server import adapter and transfer tests. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Retain owner handover as an actual offline fallback, with the same records as cloud synchronization and verifiable receipt levels.

## Execution slices

### EP16.1 — independently reviewable slice
Define a versioned bounded recovery archive: original operation envelopes/authenticity evidence, snapshot/grant references, closing manifest, needed counts/checklist data, and a manifest of separately pending media. Encrypt sensitive contents for the authorized receiver using reviewed libraries.

### EP16.2 — independently reviewable slice
Implement resumable multipart/animated QR transport with sequence/session metadata, duplicate/missing-frame handling, integrity validation and progress. A QR pairing link alone is not the full data transfer. Test a realistic maximum journal; expose limits honestly.

### EP16.3 — independently reviewable slice
Implement a prepared offline-capable owner recovery page with camera/storage preflight and identity-bound durable staging/import. Its local receipt proves owner-device storage only. A later backend receipt proves cloud ingestion. Partial/incompatible/tampered data never becomes a completed shift.

### EP16.4 — independently reviewable slice
Implement the authorized server import route using the same operation IDs/digests and business transaction services as regular sync. Provide return receipt scanning to staff, retain copies, and distinguish local receipt, server receipt and review completion.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP16-T01 | I/D/W | Transfer a shift with WAN disabled on prepared sender and owner receiver. | The owner verifies and durably stores the complete ledger; receipt says locally received, not cloud synced. |
| EP16-T02 | I | Interrupt frames, repeat frames, change order, restart the receiver and resume. | No partial business import; verified reconstruction resumes without double effects. |
| EP16-T03 | I/S | Partially sync first, import QR twice, then sync the original cashier again. | One set of sale/tender/stock/closing effects and stable receipts across every path. |
| EP16-T04 | I/S | Import foreign-tenant, tampered, expired-policy, wrong-epoch or oversized/decompression-bomb payloads. | Bounded secure rejection/quarantine with preserved original evidence and no secret disclosure. |
| EP16-T05 | I/D | Lose the owner storage commit or return receipt after a scan. | No false handover; retry is safe and the staff retains its copy. |
| EP16-T06 | I/W | Archive declares missing proof images but all ledger records are present. | Ledger handover succeeds with explicit media/review pending; no false full-media completion. |
| EP16-T07 | D | Scan the representative maximum payload on the supported owner/staff devices. | Record actual size, duration, retry behavior and storage persistence; do not claim single-static-QR capacity. |

## Completion gate

G4 recovery subgate requires real camera/device and offline owner-page evidence plus security-reviewed import deduplication.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Disable the new importer while retaining verified archives/receipts on error. Never purge sender data solely because a QR was displayed.
