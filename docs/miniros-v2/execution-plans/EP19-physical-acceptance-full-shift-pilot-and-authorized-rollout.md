# EP19 — Physical acceptance, full-shift pilot and authorized rollout

**Implementation prerequisites:** EP17, EP18

**Agent owner:** Lead + independent QA/security + actual staff/owner for physical and release steps

**Proposed file ownership:** Acceptance evidence, controlled staging fixtures, pilot/release/rollback records; production only after explicit authorization. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Validate the entire agreed product on real hardware and actual staff behavior before claiming Miniros is reliable or releasing it.

## Execution slices

### EP19.1 — independently reviewable slice
Run G1–G5 required physical/hosted cases on named real devices in every supported role pairing, including offline cold launch, both network failures, token expiry, lock/call/reboot and duplicate/QR recovery. Fix defects through their owning plans and rerun affected regressions.

### EP19.2 — independently reviewable slice
Run the eight-hour rehearsal, deterministic stress stream and golden fixture comparisons. Record latency distributions, storage/thermal/battery observations, device versions, logs and exact count/tender/order reconciliation. Do not invent results for unavailable devices.

### EP19.3 — independently reviewable slice
Run an owner/staff readiness review and approved controlled Bettercup pilot with one authoritative sales ledger. Do not double-enter real sales in old/new systems as competing authorities; use a clearly non-authoritative reconciliation record if needed. Keep a documented manual fallback.

### EP19.4 — independently reviewable slice
Prepare signed build distribution, staged schema deployment, supported-device list, rollout flag, incident owner, rollback procedure and release checklist. Obtain explicit owner approval before production writes/publishing. Observe the authorized pilot and expand only after reconciliation/sign-off.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP19-T01 | D/S | Complete a prepared shift with WAN unavailable from opening through closing. | Sales/prep/inventory/closing work locally; later cloud receipt matches every recorded effect. |
| EP19-T02 | D | Run Android–Android, iOS–iOS and both mixed-role pairings with the failure matrix. | All advertised pairings pass; unsupported/untested conditions are explicit release blockers. |
| EP19-T03 | D/I | Run full-length mixed operations, 3,000-operation stress and repeated recovery cycles. | No lost/doubled logical effects in reconciliation; proposed performance measurements and resource limits are documented. |
| EP19-T04 | D/S | Use QR fallback after partial cloud delivery, then reconnect the cashier. | Owner/local/cloud totals match once; receipt levels and pending attachments remain honest. |
| EP19-T05 | P | Owner schedules with only essentials; staff packs/counts/serves/closes without developer intervention. | The agreed division of work is demonstrated, not replaced by manual owner provisioning. |
| EP19-T06 | Review | Audit every EP/test evidence row and reviewer finding. | No required row is silently skipped; no unresolved data-loss, security, duplicate-charge or false-receipt defect remains. |
| EP19-T07 | P/S | Rehearse the approved pilot stop/rollback procedure. | New shifts stop safely, current journals remain intact and the owner knows how to reconcile/recover. |

## Completion gate

All release gates accepted and G6 explicit owner authorization obtained. Missing phones/credentials/signing/pilot approval remain BLOCKED, not done.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Pause onboarding of new shifts, preserve active device state, revert only compatible code/flags and execute the documented reconciliation/recovery runbook.
