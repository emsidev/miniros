# Session handoff — EP00 / EP01 complete

Date: 7 September 2026. Repository: emsidev/miniros development checkout at
`/Users/emsi/Documents/ChatGPT/MINIROS/miniros`. Branch: `dev`.

## Checkpoints and preservation

- Starting commit: `edbba0e4fd86459a40a372b5c4abf83558fc7d43` (clean nested checkout).
- Preserved reference: local `codex/ep00-ep01-baseline` points to that starting commit.
- EP00 accepted checkpoint: `657a6c28eeeeeac2bc119fa7c5ab1d90cdfe93b6`.
- EP01 accepted implementation/evidence checkpoint: `66af5263e864b1ef181620d59cd1941e9b0997d7`.
- This handoff and the final status pointer are recorded in a subsequent documentation
  commit; use `git log -1 --oneline` for that checkpoint. No source changes after EP01.

The parent workspace's untracked design/ was preserved. No data reset, production
migration, push or deployment. No dependency/lockfile/schema changes. Legacy Dexie
journals and existing routes remain intact. Compiler cache restored. Task servers and
isolated browsers stopped; no background worker or worktree remains active.

## Completed scope

EP00 finished and received independent G0 acceptance before EP01 began. Baseline
commands, skips/placeholders, reuse mapping, two-tenant fixtures, pre-write target
guards and preservation procedure are in BASELINE_AUDIT.md / EP00_EVIDENCE.md.
INC-001 is confirmed only in isolated coordinator reproduction: failed proof A blocks
sale B upload; three actions and both local sales remain retained. No data loss claim.

EP01 adopts product/state/authority decisions, a conceptual v2 event boundary and
independently tested transition graph. Minimal owner schedule and staff supply/count/
sell/prep/close walkthrough is runnable only in opted-in development. It is synthetic
memory UI, **not working booth operations**. All ten stage acceptance IDs map to
EP00_EVIDENCE.md / EP01_EVIDENCE.md and TEST_CASE_INDEX.json. Detailed architecture
and legacy contract mapping: ARCHITECTURE_DECISIONS.md / WORKFLOW_CONTRACTS.md.

Owner schedules only date/times, venue/address and staff. Catalog/checklist readiness
is automatic in the adopted contract; staff resolves supplies and enters actual
opening counts. No owner per-shift stock/product allocation was introduced.

## Exact final validation

| Check                                                                                                                                         | Result                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile` (EP00)                                                                                              | Passed, unchanged lockfile                                                                           |
| `corepack pnpm typecheck --force`                                                                                                             | 11/11 fresh tasks passed                                                                             |
| `corepack pnpm lint --force`                                                                                                                  | 11/11 fresh tasks passed                                                                             |
| `env -u SHIFT_TEST_DATABASE_URL -u MINIROS_PREVIEW_URL corepack pnpm test --force`                                                            | domain53, contracts106, web155 passed /12 PG skipped, workflow41 passed /4 HTTP skipped; no failures |
| `corepack pnpm --filter @miniros/web exec vitest run src/features/offline/application-providers.test.ts src/lib/development-skeleton.test.ts` | 2 passed after test lint correction                                                                  |
| `node scripts/acceptance/ep01-browser.mjs` with documented isolated runner environment                                                        | 35 browser assertions passed; no API requests/page errors; 360/768/1280px no overflow                |
| `MINIROS_V2_SKELETON=1 corepack pnpm --filter @miniros/web build`                                                                             | Passed;122 PWA assets; web only                                                                      |
| `env -u SHIFT_TEST_DATABASE_URL MINIROS_PREVIEW_URL=http://localhost:3100 corepack pnpm e2e` against local production build                   | 45 passed,0 skipped                                                                                  |
| production `/dev/workflow-skeleton` with flag1                                                                                                | HTTP404 verified                                                                                     |
| `git diff --check`                                                                                                                            | Passed                                                                                               |

Root task counts include echo-only mobile/api/agent/site/db/sdk scripts and token
consistency; those are explicitly non-evidence. Test invocations overlap; do not sum
as unique workflow coverage. Raw logs remain ignored local artifacts; committed
`evidence/LOG_CHECKSUMS.txt` verifies them. Exact browser runner setup is in EP01_EVIDENCE.

Independent reviewer accepted G0 then EP01-T01–T05. Review fixes: initialize tracker,
remove generated cache delta, and replace production-derived graph test oracle with
an independent expected graph. Lead also corrected early skeleton stock/supply/input
semantics. Browser harness issues were fixed/replaced, not hidden as application passes.

## Agents actually used

- Lead/integrator: inherited session settings, no override (exact model/effort identifier
  not exposed). Sole writer for contracts, guards/integration, evidence and browser tests.
- repository_audit: `gpt-5.6-terra`, `medium`; read-only repository/domain/traceability audits.
- test_audit: `gpt-5.6-terra`, `medium`; read-only baseline test audit, then scoped UI implementation.
- reviewer: separate read-only agent, inherited lead settings, no override; independent checks.

Maximum three concurrent subagents. No pending file ownership or unfinished agent work.

## Blockers and next task

**The next development batch is unblocked, but has NOT started.** EP02 feasibility and
EP03 portable domain work depend on accepted EP01, now satisfied. This staged run stops
here. Begin a separately authorized batch by reading full EP02 and EP03 plans and
assigning disjoint scopes from this checkpoint; do not infer release authorization.

EP02 native transport conclusions require Android and iPhone devices (both mixed role
combinations), build/signing/permissions and real radio/reconnect evidence. No native
transport/library or crypto scheme is selected as proven. Multi-connection PostgreSQL
needs the dedicated guarded disposable endpoint. Hosted auth/RLS/Storage/Realtime,
SQLite crash tests, owner camera/offline storage, full-shift pilot and owner release
approval remain later gates. INC-001 remains open for EP13, not patched by this skeleton.

To inspect the completed walkthrough only:

```sh
MINIROS_V2_SKELETON=1 corepack pnpm --filter @miniros/web dev --port 3101
```

Open `http://localhost:3101/dev/workflow-skeleton`. Reload discards fixture memory.
Do not start a production build concurrently with that dev server. No deployment,
production migration or deletion of legacy records is authorized.

## Changed files

- `AGENTS.md`
- `apps/web/src/app/dev/workflow-skeleton/page.tsx`
- `apps/web/src/app/dev/workflow-skeleton/skeleton.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/features/offline/application-providers.test.ts`
- `apps/web/src/features/offline/application-providers.tsx`
- `apps/web/src/lib/development-skeleton.test.ts`
- `apps/web/src/lib/development-skeleton.ts`
- `apps/web/src/lib/offline/sync.test.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/server/services/admin-shift-workflows.db.test.ts`
- `apps/web/src/server/services/schedule.db.test.ts`
- `apps/web/src/test/isolation-guard.test.ts`
- `apps/web/src/test/isolation-guard.ts`
- `docs/miniros-v2/ARCHITECTURE_DECISIONS.md`
- `docs/miniros-v2/BASELINE_AUDIT.md`
- `docs/miniros-v2/EP00_EVIDENCE.md`
- `docs/miniros-v2/EP01_EVIDENCE.md`
- `docs/miniros-v2/EXECUTION_STATUS.md`
- `docs/miniros-v2/INCIDENT_LOG.md`
- `docs/miniros-v2/REQUIREMENTS_TRACEABILITY.md`
- `docs/miniros-v2/TEST_CASE_INDEX.json`
- `docs/miniros-v2/WORKFLOW_CONTRACTS.md`
- `docs/miniros-v2/evidence/LOG_CHECKSUMS.txt`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/staff-workflow.ts`
- `packages/contracts/tests/staff-workflow.test.ts`
- `scripts/acceptance/ep01-browser.mjs`
- `docs/miniros-v2/SESSION_HANDOFF.md` (this final handoff)
