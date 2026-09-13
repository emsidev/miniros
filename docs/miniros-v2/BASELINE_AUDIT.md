# EP00 baseline audit — 7 September 2026

Source: development checkout `/Users/emsi/Documents/ChatGPT/MINIROS/miniros`,
branch `dev`, commit `edbba0e4fd86459a40a372b5c4abf83558fc7d43`.
Reference preserved by local branch `codex/ep00-ep01-baseline`; no reset/switch.
The checkout began clean. Parent repository's untracked `design/` is unrelated.
Root AGENTS.md is the only applicable project instruction file; dependency-owned
AGENTS files under node_modules do not govern our sources.

Environment: macOS, Node 24.19.0, Corepack pnpm 10.2.1; lockfile frozen install
passed without dependency changes. Next 15.5.25, Expo 57.0.20 / RN 0.86.3.
No Next/Metro build or development server was active before the baseline build.
Optional external test URLs were explicitly unset for baseline suites.
No hosted data/auth/storage calls or migrations were used for tests.

## Discovered command results (fresh execution)

| Command                                                                            | Actual result                                                             | Scope / limitation                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                          | exit 0                                                                    | existing pinned dependencies; Husky prepare                                |
| `corepack pnpm typecheck --force`                                                  | 11/11 tasks, zero cached, exit 0                                          | no runtime validation                                                      |
| `corepack pnpm lint --force`                                                       | 11/11 tasks, zero cached, exit 0                                          | Next lint deprecation warning                                              |
| `env -u SHIFT_TEST_DATABASE_URL -u MINIROS_PREVIEW_URL corepack pnpm test --force` | domain 53/0/0, contracts 1/0/0, web 144/0/12, e2e 41/0/4 (pass/fail/skip) | test invocations overlap store/worker cases; do not sum as unique coverage |
| `env -u SHIFT_TEST_DATABASE_URL -u MINIROS_PREVIEW_URL corepack pnpm e2e`          | 41 passed, 0 failed, 4 skipped                                            | Vitest service/workflow suite, not browser/native automation               |
| `corepack pnpm --filter @miniros/web build`                                        | exit 0, 121 PWA assets                                                    | web build only; no release acceptance                                      |
| `git diff --check`                                                                 | exit 0                                                                    | whitespace check                                                           |

Ignored local raw logs: `evidence/baseline-{install,typecheck,lint,test,e2e,build}.log`.
Checksums are recorded in `evidence/LOG_CHECKSUMS.txt` for those local artifacts.

Echo-only tests: mobile, agent, api, site, db, sdk. UI test verifies generated tokens,
not UI behavior. Mobile build exports **web**, not Android/iOS. These scripts remain
explicit non-evidence; native replacement belongs to subsequent foundation work.
Optional PostgreSQL: 8 admin workflow + 4 schedule concurrency tests skipped.
Optional local production HTTP: 4 tests skipped until a verified local server exists.
PGlite service tests exercise the PostgreSQL-compatible engine but not multiple
PostgreSQL connections or hosted Supabase auth/storage/realtime.

## Reuse / modify / replace and table-to-service map

| Existing boundary                                                                | Decision / future change                                                                                                                                  |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain` money, quantity, recipes, inventory deductions, no overselling | reuse tested rules; extend in EP03 without changing golden oracle                                                                                         |
| `packages/db/src/schema/{shifts,sales,inventory}.ts`                             | retain shifts/assignments/costs, sale/line/payment snapshots, inventory ledger and history                                                                |
| `admin-shift-workflows.ts`, `schedule.ts`, `shift-join.ts`                       | reuse locks, row versions, scoped assignments and audit; later add planned time contract                                                                  |
| `offline-sessions` schema + server `offline-prepare`, `offline-sync` services    | retain snapshots, one session, storage/device binding, sequence/digest idempotency; extend explicitly for authority/grants/peer/cloud/media               |
| web `lib/offline/store.ts`                                                       | preserve Dexie atomic action/projection/proof transaction; native SQLite is a future adapter, not an in-place browser DB replacement                      |
| `lib/offline/database.ts`, `queue.ts`                                            | retain read-only legacy archive; never replay unbound legacy records as authenticated new actions                                                         |
| web `lib/offline/sync.ts`                                                        | confirmed photo coupling, see INCIDENT_LOG.md; separate paths in EP13, no premature production fix here                                                   |
| `payment-proofs.ts`, `offline-http.ts`, `access.ts`                              | retain private proof validation, CSRF, active membership/tenant/role checks; native API must add scoped authorization                                     |
| migrations `20260905040950*`, `20260905071237*`                                  | preserve server-only journals and write grants; services currently enforce same-tenant FKs; future critical relationships need durable tenant constraints |
| `apps/mobile/src/app/AppRoot.tsx`                                                | static Expo catalogue shell; development skeleton only in EP01, native operations not implemented                                                         |
| owner current shift planning                                                     | no owner product/stock picker; optional legacy costs preserved; new scheduling contract only times, venue/address, staff                                  |

Read README, manifests, lockfile, schema/migrations and RLS, auth, offline store/replay,
current schedule/mobile UI and `docs/offline-acceptance.md`. Earlier acceptance
observations are historical evidence, not results of this run.

## Isolation and legacy preservation procedure

1. Record HEAD, branch and tracked/untracked status before work. Retain local baseline
   reference above; never stash/reset unrelated files. No data files enter commits.
2. Default suites use per-test PGlite and uniquely named fake IndexedDB; synthetic
   `preparedFixture()` tenants have random IDs, no customer data. Cleanup deletes
   only databases created by the fixture in that process.
3. `src/test/isolation-guard.ts` now gates both optional destructive PostgreSQL suites
   before client construction. Only `postgres[ql]://127.0.0.1:55432/miniros_ep00_disposable`
   (optional credentials, no query/hash) is allowed. Provision that dedicated disposable
   server separately; no server was provisioned or contacted here. Hosted staging is
   denied by this guard and requires a separately reviewed explicit isolation policy.
4. Never run `db:migrate` (`supabase db push`) during routine validation. Even
   `db:migrate:local` requires verified disposable target; no migrations run this session.
5. Before future cutover, inventory retained `miniros-offline` and
   `miniros-prepared-shifts` per installation/account; keep original devices. Export
   through reviewed authorized tooling, checksum encrypted backups, and read back in an
   isolated restore rehearsal. Do not copy secrets or payloads into evidence logs.
6. Finish/reconcile active legacy shifts in their original client. Match action IDs,
   sequences, financial totals, attachment receipts, and pending reviews with server
   records. Unreceived/conflicted work stays retained and blocks cleanup.
7. Enable new runtime only for new shifts after migration/rollback/device gates. Rollback
   disables the new-shift flag and retains all journals; never downgrade an active journal
   or delete unsent media. Restore requires owner-approved procedure; not executed here.

EP00 changes only documentation and isolated tests/guards. No schema, application
workflow, installed browser storage, hosted business records or parent design files
were changed. Before/after git evidence and reviewer findings are in EP00_EVIDENCE.md.
