# EP17 — Staff usability, accessibility and end-to-end workflow polish

**Implementation prerequisites:** EP08, EP09, EP10, EP11, EP12, EP14, EP15, EP16

**Agent owner:** UX/mobile/owner agents with disjoint screens + independent interaction QA

**Proposed file ownership:** Existing Miniros design tokens and implemented screens; no protocol/schema redesign in the polish plan. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Validate that the reliable system also reduces staff effort, using real workflows rather than another generic dashboard redesign.

## Execution slices

### EP17.1 — independently reviewable slice
Run the complete implemented workflow and improve navigation, wording, touch targets, category/search behavior, numeric keyboards, inline errors and recovery affordances. Keep owner and staff navigation separate.

### EP17.2 — independently reviewable slice
Review long product names/modifiers, large queues, empty states, missing checklist items, stock shortages, large text, screen-reader traversal and reduced-motion/sound settings. Preserve existing platform branding.

### EP17.3 — independently reviewable slice
Add real browser UI automation for owner and suitable native UI automation for staff. Capture/inspect actual screenshots and interactions, including error/offline states; test double-tap prevention without compromising retry.

### EP17.4 — independently reviewable slice
Conduct a two-person rehearsal: create schedule, pack, count, serve mixed orders, handle an outage, record a remake and close. Record where staff hesitates or repeats entry; fix focused issues without rewriting correct domain rules.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP17-T01 | W/D | Complete the flow on supported small/large phones with native text scaling. | No clipped totals, unreachable actions, horizontal overflow or loss of count drafts. |
| EP17-T02 | W/D | Use screen reader, keyboard where supported and reduced motion. | Controls have useful names/order, visible focus, readable errors and no motion-only feedback. |
| EP17-T03 | W | Schedule a new shift after business setup. | Owner performs no repeated catalog/stock/checklist preparation. |
| EP17-T04 | W/D | Find five uncounted items among a realistic catalog and enter partial packs. | Category/search/filter state remains stable and recorded quantities are correct. |
| EP17-T05 | D/P | Simulate a busy queue and local/cloud failure separately. | Cashier can identify undelivered prep orders; staff is not blocked by a cloud-only delay. |
| EP17-T06 | W/D | Exercise refund/remake/close/QR retry error paths. | Each has clear confirmation/result without hidden destructive defaults. |
| EP17-T07 | P | Observe staff completing the rehearsal without developer navigation assistance. | Record completion/errors/confusion and resolve release-blocking usability problems. |

## Completion gate

G5 usability subgate: independent actual-screen review and staff rehearsal evidence; static mockups do not count.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Revert isolated presentation changes only; do not change ledger semantics or data retention to make a UI simpler.
