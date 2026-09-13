# Session handoff — EP02 through EP05 local implementation complete

Date: 7 September 2026. Authorized scope was clarified by the user as **EP02, then EP03–EP05**. Work stops after EP05. EP06+ and rollout remain unauthorized.

## Checkout and preservation

Application root: `/Users/emsi/Documents/ChatGPT/MINIROS/miniros`, branch `dev`, baseline/current HEAD `0056f316cf811f10f943d56c4c987b1642844938`. All changes from this run remain uncommitted. The parent wrapper at `/Users/emsi/Documents/ChatGPT/MINIROS` remains `main`, HEAD `54cb95a3031c1041da423bdbb5a0b14cba915ac5`.

Preserved the preexisting AGENTS.md Rams instruction and the parent checkout's four untracked shift-design PNGs. No branch switch, reset, clean, stash, Miniros remote lookup/sync, push, deployment or production data mutation occurred. Only the generated tracked web compiler cache was restored to its clean starting bytes after validation. Legacy journals and original golden fixture were not rewritten. Temporary test SQLite files were removed by their own tests; the task PostgreSQL cluster and synthetic data remain under `/tmp/miniros-ep05-postgres` for reproduction.

Historical EP00/EP01 checkpoints remain documented in EXECUTION_STATUS.md: original `edbba0e4fd86459a40a372b5c4abf83558fc7d43`, EP00 `657a6c28eeeeeac2bc119fa7c5ab1d90cdfe93b6`, EP01 `66af5263e864b1ef181620d59cd1941e9b0997d7`. This run did not amend those commits.

## Completed implementation and accepted evidence

| Stage | Result                                                                                                                                                                                        | Evidence                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| EP02  | Authenticated scoped native peer spike, replaceable transport, durable SQLite before ACK, bounded catch-up/failure harness; native source and portable tests accepted                         | EP02_EVIDENCE.md, EP02_NATIVE_REPORT.md, EP02_REVIEW_REPORT.md, EP02_DEVICE_RUNBOOK.md |
| EP03  | Versioned immutable snapshots/envelopes, exact money/atoms/recipes, 12 pure journal operations, independent golden/property/legacy contracts; U gate accepted                                 | EP03_EVIDENCE.md, EP03_CONTRACTS.md, EP03_REDUCER_REPORT.md, EP03_REVIEW_REPORT.md     |
| EP04  | Real SQLite atomic journal/projection/tenders/drafts/queues/receipts/media, additive migrations, readback, identity isolation and process-kill recovery; I gate accepted                      | EP04_EVIDENCE.md, EP04_PERSISTENCE_REPORT.md, EP04_REVIEW_REPORT.md                    |
| EP05  | Additive Drizzle/PostgreSQL persistence, native Bearer Auth adapter, signed grants/ingestion/prep, original receipts, quarantine and audited owner recovery; local I/security review accepted | EP05_EVIDENCE.md, EP05_BACKEND_REPORT.md, EP05_REVIEW_REPORT.md                        |

The root golden integration saves/closes all 19 operations while cloud remains at sequence zero, reopens SQLite, then delivers every operation with a response-loss retry. Both final projections match the independent fixture: net sales 52,000 and expected cash 240,000 minor units, with all nine stock balances exact. Cloud pending becomes zero while peer pending stays 19 and four attachment jobs remain independent. Central inventory receives no opening debit.

Independent review found a P1 dual-protocol reservation race: a waiting legacy REPEATABLE READ transaction could miss a newly inserted native authority. New authority creation now updates the locked shift row, forcing the stale legacy waiter to fail with 40001. Both race directions assert different real PostgreSQL PIDs and actual lock waits. No second authority/session remains. The baseline data-access test also caught client creation outside lib/supabase; the stateless factory now lives in that directory and exposes only Auth. Both fixes are independently accepted.

## Final validation

All final checks ran from the application root using Node 24.19.0, pnpm 10.2.1, SQLite 3.53.3 and task-owned PostgreSQL 18.0.

| Check                                                                                    | Final result                                                                                                                                 |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                                | Passed; no lockfile resolution/download change                                                                                               |
| `env DATABASE_URL= corepack pnpm typecheck --force`                                      | 11/11 fresh tasks passed                                                                                                                     |
| `env DATABASE_URL= corepack pnpm lint --force`                                           | 11/11 fresh tasks passed                                                                                                                     |
| Full root tests with the guarded PostgreSQL URL and local production preview             | **627 tests passed, zero failed/skipped**: domain 110, contracts 143, mobile 123, web 206, workflow/HTTP 45                                  |
| Native-focused backend/reviewer/golden/data-access suite                                 | 40 passed across seven files; overlaps root totals                                                                                           |
| Web production build using fake loopback public env, no database, new-authority flag off | Passed; 128 PWA static assets, private pages excluded                                                                                        |
| Local production HTTP checks                                                             | Six native POST routes reject missing Bearer even with malformed web cookies (403/no-store); development route 404 even with skeleton flag 1 |
| Native prebuild/autolinking/JS bundles                                                   | Passed for EP02 source; **not native binaries**                                                                                              |
| Native compiler/device preflights                                                        | BLOCKED, exit 2; reasons below                                                                                                               |
| `git diff --check` and protected-file comparison                                         | Passed                                                                                                                                       |

The full test command was:

```sh
env DATABASE_URL= \
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-local-public-key \
  SHIFT_TEST_DATABASE_URL=postgres://127.0.0.1:55432/miniros_ep00_disposable \
  MINIROS_PREVIEW_URL=http://127.0.0.1:3100 \
  corepack pnpm test --force
```

The production build/start used the same explicit fake public env and empty DATABASE_URL, plus `MINIROS_V2_SKELETON=1` and `MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED=0`. Final build ID is recorded in `evidence/ep05-production-http.json`. The production server and task-owned PostgreSQL server were stopped after checks. No test/agent process is required to continue this task.

Raw logs are retained under `docs/miniros-v2/evidence/ep02-*` through `ep05-*`, including the initial architecture-boundary failure, corrected final results, migration application and server shutdown. `evidence/LOG_CHECKSUMS.txt` records log hashes; `evidence/EP02_EP05_SOURCE_CHECKSUMS.sha256` identifies final owned source/document bytes. Echo-only db/sdk/api/agent/site test tasks remain non-evidence; the 627 count includes only the five substantive test suites. Independent and focused invocations overlap and are not additional unique tests.

## Ownership, design skills and compatibility

The lead owned contracts, dependency manifests/lockfile, SQLite migrations, Drizzle schema/SQL/metadata, legacy integration guards, the full golden integration test and status/handoff. Three actual subagents were reused: `native_connectivity` (EP02, EP03 reducer, EP04 persistence), `backend` (EP05 service), and `independent_review` (failure/security tests and separate reports). No model override or extra agent was created. All scopes are complete and frozen.

Applied Impeccable native/Operate guidance and Emil Kowalski design engineering to the diagnostic screen, retaining Miniros tokens and safe-area/accessibility behavior. The requested frontend taste skill explicitly excludes native operations UI; that boundary was respected. Rams quick review and score review ran after UI edits (95/100, no critical findings); the two detailed hierarchy/spacing issues were fixed and independently verified. Rams verify_fixes did not recognize the source fixes, so no Rams all-clear or native visual acceptance is claimed. No native screenshot was fabricated from a web view.

Migration and safe rollback instructions are in EP04_EP05_MIGRATIONS.md. PostgreSQL adds `20260907143003_native_v2_persistence.sql`; no prior migration changed. SQLite adds versions 1/2 in an isolated file. Do not drop/reset retained evidence on errors. New native authority creation defaults off behind `MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED=1`; existing original receipts and replay continue with the flag off. A rollback must preserve the legacy/v2 reservation guards while any v2 authority exists; an unpatched pre-EP05 server is unsafe for those reservations.

## Remaining gates and next authorized action

- **EP02/G1:** no Java runtime/JDK, Android SDK/adb, full Xcode or CocoaPods; phones/signing are unavailable. Native binaries and Android/Android, iPhone/iPhone, and both mixed-role physical tests remain BLOCKED. Nearby is provisional. Follow EP02_DEVICE_RUNBOOK.md when the environment is ready.
- **EP04 physical G2:** desktop SQLite and real SIGKILL are I evidence. Installed native cold-start/autosave, device storage exhaustion, suspension, flash/power and backup behavior remain BLOCKED D.
- **EP05 hosted S:** synthetic in-process getUser and local PostgreSQL Auth/Storage models do not prove hosted Auth, Data API, RLS/views, Storage, Realtime or revocation propagation. Explicit staging authorization/credentials are needed; no hosted work was attempted.
- Native enrollment/protected private keys and automatic preparation are EP07 work. Complete POS/prep transport, encrypted financial mirroring, QR scanning/UI, production migration and pilot are not implemented/accepted here. EP04's cashier financial peer queue is disconnected from EP02's synthetic transport.
- Legacy INC-001 proof upload stalls later financial upload remains recorded for EP13; additive v2 queues do not retroactively fix the legacy coordinator.

**Stop after EP05.** Resume only a separately authorized stage or the blocked native/device/staging checks. To reproduce local PostgreSQL tests, restart only the retained task-owned cluster with the commands in EP05_BACKEND_PREPARATION.md; its 17 migrations are already applied, so do not reset it or reapply the migration blindly.
