> Release scope update — 2026-09-12: the native-first sequence below is superseded for the connected staff PWA release by [PWA_OVERHAUL.md](../PWA_OVERHAUL.md). Native implementation, evidence and authority guards remain preserved. This is not a deletion or reversal of native work.

# Execution status — EP02 through EP05 local implementation complete

User-authorized scope: **EP02, then EP03–EP05**. This run stops after EP05.
EP06+ and production rollout are not authorized. EP00/EP01 accepted evidence is
preserved below as historical context.

Source: `/Users/emsi/Documents/ChatGPT/MINIROS/miniros`, branch `dev`, baseline
`0056f316cf811f10f943d56c4c987b1642844938` plus uncommitted local changes.
The parent wrapper remains `main` at `54cb95a3031c1041da423bdbb5a0b14cba915ac5`.
The preexisting AGENTS.md Rams instruction and parent design mockups are preserved.
No branch switch, reset, stash, remote repository inspection/sync, push, deployment
or production-data mutation occurred.

The lead owned shared contracts, manifests/lockfile, both migration sets, integration,
status and handoff. Three actual subagents were reused with disjoint write scopes:
`native_connectivity`, `backend`, and `independent_review`. All implementation and
review scopes are now frozen; final aggregate checks are recorded in SESSION_HANDOFF.md.

| Plan                                                                        | Implementation                    | Automated evidence                                                         | Device/hosted evidence                                     | Review                               | Evidence / next gate                                                    |
| --------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| EP00 — Baseline audit, preservation, and truthful test inventory            | CODE COMPLETE                     | PASSED with explicit baseline skips                                        | NOT REQUIRED for G0; hosted/device unverified              | ACCEPTED G0                          | See EP00_EVIDENCE.md; G0 accepted before EP01                           |
| EP01 — Product contract, architecture decisions, and runnable UX skeleton   | CODE COMPLETE                     | PASSED U/W; baseline PG skips disclosed                                    | NOT REQUIRED for EP01; native/hosted unverified            | ACCEPTED                             | Stop: EP02/EP03 next batch development unblocked; external gates remain |
| EP02 — Native two-phone communication spike                                 | PORTABLE / NATIVE SOURCE COMPLETE | PASSED: 69 U/I tests; native prebuild and JS bundles                       | BLOCKED: native compilation and all four physical pairings | ACCEPTED portable/source; G1 blocked | EP02_EVIDENCE.md and EP02_DEVICE_RUNBOOK.md                             |
| EP03 — Shared contracts and golden arithmetic                               | CODE COMPLETE                     | PASSED: domain 110 / contracts 143; 72 independent tests                   | U gate requires no device                                  | ACCEPTED                             | EP03_EVIDENCE.md and EP03_CONTRACTS.md                                  |
| EP04 — Crash-safe SQLite ledger                                             | CODE COMPLETE                     | PASSED: 54 actual SQLite tests; full golden restart/integration            | BLOCKED: physical native cold-start/storage checks         | ACCEPTED I; physical G2 blocked      | EP04_EVIDENCE.md and EP04_REVIEW_REPORT.md                              |
| EP05 — Native authorization and safe ingestion                              | CODE COMPLETE                     | PASSED: author 14 / independent 24; real PostgreSQL and golden integration | BLOCKED: hosted Supabase Auth/Storage/Realtime             | ACCEPTED local I; hosted S blocked   | EP05_EVIDENCE.md and EP05_REVIEW_REPORT.md                              |
| EP06 — Owner reusable business setup and lightweight shift scheduling       | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP07 — Staff enrollment, automatic snapshots, and departure preflight       | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP08 — Departure checklist with missing-item handling                       | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP09 — Intuitive opening-stock counts and opening seal                      | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP10 — Cashier checkout and durable order creation                          | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP11 — Reliable prep queue and bidirectional local synchronization          | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP12 — Operational inventory, remakes, refunds, waste and restocks          | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP13 — Independent cloud synchronization, media retry and auth recovery     | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP14 — Owner live dashboard with honest freshness and reconciliation        | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP15 — Offline local closing, actual counts and owner review                | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP16 — QR recovery export, offline owner import and duplicate-safe handover | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP17 — Staff usability, accessibility and end-to-end workflow polish        | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP18 — Migration safety, observability, CI and release hardening            | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |
| EP19 — Physical acceptance, full-shift pilot and authorized rollout         | NOT STARTED                       | NOT RUN                                                                    | NOT RUN / assess required tier                             | PENDING                              | Begin after listed prerequisites                                        |

New v2 authority creation defaults off. Existing receipts and replay remain available
when the flag is disabled. Rollback must retain compatibility guards for existing v2
reservations. Migration/rollback detail: EP04_EP05_MIGRATIONS.md.

The real golden integration saves 19 operations locally, reopens SQLite and delivers
each to PostgreSQL with a response-loss retry. Final projections match; cloud pending
is zero while peer pending stays 19 and four attachment jobs remain independent.
Independent review reproduced and fixed a P1 legacy/native REPEATABLE READ reservation
race; both ordering regressions assert separate backend PIDs and actual lock waits.

Native compiler tools/phones and hosted staging credentials remain unavailable. No
simulator, browser, mock transport or desktop SQLite test is physical evidence.
The complete POS, native secure enrollment, encrypted prep financial mirror, QR UI
and staff pilot remain later work. The legacy INC-001 media stall remains scoped to
EP13; the additive v2 queues do not retroactively repair the legacy coordinator.

<details>
<summary>Historical EP00/EP01 checkpoint — not the current run status</summary>

## Historical EP00/EP01 session checkpoint

Branch: `dev`. Original source: `edbba0e4fd86459a40a372b5c4abf83558fc7d43`.
EP00 checkpoint: `657a6c28eeeeeac2bc119fa7c5ab1d90cdfe93b6`.
EP01 checkpoint: `66af5263e864b1ef181620d59cd1941e9b0997d7`. Final handoff: SESSION_HANDOFF.md.

EP00 and EP01 are code complete and independently accepted for their stated scope.
This is **not working booth operations or release acceptance**. All ten EP00/EP01
acceptance IDs map to EP00_EVIDENCE.md / EP01_EVIDENCE.md and TEST_CASE_INDEX.json.

Final checks: root typecheck/lint 11/11 fresh; domain53/contracts106/web155 passed
(12 PostgreSQL skipped); workflow41 passed without HTTP, then local production HTTP
45/45 passed; browser35 assertions passed; web build passed; production dev-route404
with flag enabled; diff check passed. Echo-only test tasks remain non-evidence.

Preservation: initial nested checkout clean; parent design/ untouched; baseline
reference branch retained; no dependency/schema/migration/legacy journal changes.
Generated tracked compiler cache restored. No pushes, deployments, production data
writes, resets, or migrations. Task servers and isolated browsers stopped.

Actual agents: repository_audit and test_audit used gpt-5.6-terra/medium; test_audit
later implemented scoped UI files. Lead and independent reviewer inherited session
settings without override. Maximum three concurrent subagents. All work integrated;
no worker owns pending changes.

Remaining: INC-001 proof upload stalls subsequent financial upload (isolated
reproduction, local records retained), for EP13. Native two-phone transport/SQLite,
hosted auth/RLS/Storage/Realtime, camera recovery, signed device builds, physical
matrix, multi-connection PostgreSQL and staff pilot remain unverified.

Next batch: **development prerequisites unblocked for EP02 and EP03**, not started.
Read their full plans in a new authorized batch. EP02 physical conclusions require
Android/iOS devices and native build/permission setup; portable work may proceed per
pack gates. No production runtime/transport or release promise is unlocked.

Production/pilot authorization: NOT GRANTED. This run stops after EP00/EP01.

</details>
