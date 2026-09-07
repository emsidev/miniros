# EP00 — Baseline audit, preservation, and truthful test inventory

**Implementation prerequisites:** None; start here.

**Agent owner:** Lead + parallel read-only domain, mobile and QA audit agents

**Proposed file ownership:** Read repository-wide; initially write only docs/miniros-v2, isolated test fixtures, and narrowly necessary test setup. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Establish what exists, what is safe to reuse, and which failures can actually be reproduced before changing behavior.

## Execution slices

### EP00.1 — independently reviewable slice
Read root/nested AGENTS.md, the actual branch/status, README, workspace manifests/lockfile, schema/migrations/RLS, offline store/replay, auth, mobile/e2e scripts, current UX and acceptance documentation. Record the actual commit; do not reset to the reference SHA.

### EP00.2 — independently reviewable slice
Create BASELINE_AUDIT.md with reuse/modify/replace decisions, exact command and environment inventory, table/service mapping and baseline results. Flag echo-only tests, web-only native builds and skipped suites. Preserve a reference commit without touching unrelated work.

### EP00.3 — independently reviewable slice
Create disposable two-tenant fixtures and a redacted incident log. Reproduce the reported photo-upload blocking candidate with a failed upload between sales A and B; label it confirmed only after observation. Inventory other reported symptoms rather than inventing a postmortem.

### EP00.4 — independently reviewable slice
Initialize execution/evidence tracking, local/staging isolation guards and a reviewed legacy-data preservation procedure. Existing business data stays untouched.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP00-T01 | I | Run the discovered baseline commands in isolation. | Record exact pass/fail/skip counts and required missing environments; echo-only tests are explicitly non-evidence. |
| EP00-T02 | I | Attempt a destructive test command against a non-allowlisted database URL. | Guard rejects it before any write; no production secrets or identifiers enter logs. |
| EP00-T03 | I | Inject a proof failure with another sale queued. | Capture whether later financial upload stalls; record reproducible behavior without claiming data loss. |
| EP00-T04 | Review | Compare working tree before/after audit and fixture setup. | Unrelated changes, retained journals and hosted data are unchanged. |
| EP00-T05 | Review | Audit the proposed owner scheduling workflow. | No new owner per-shift stock or product selection is retained as a prerequisite. |

## Completion gate

G0: independent reviewer accepts baseline truth and isolated test targets. Existing failing cases remain documented, not waived.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Only documentation/test setup is introduced; discard isolated fixtures if needed, never reset business data.
