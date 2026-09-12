# EP04 independent persistence review

## Verdict

**ACCEPTED for portable implementation/integration evidence.** The final independent suite passes **28/28 tests, 0 failures, 0 skips**. No unresolved P1/P2 source finding remains in the reviewed persistence slice. This is not native-build, physical-device, pilot or production acceptance.

The review used the current local checkout and the dirty local instructions. It did not read Miniros remotely, change branches, synchronize git, commit, deploy or change the golden fixture. Review-owned artifacts are `apps/mobile/tests/ep04-review/**` and this report. Implementation fixes remained with their owners.

## Independent evidence

The suite uses Node 24.19.0, real SQLite 3.53.3 files and an independently written worker-backed driver. Every competing connection has its own SQLite worker and database connection; the coordinator remains able to release a held lock. The two crash tests fork a separate OS process, wait for its explicit transaction boundary, send **SIGKILL**, verify termination by that signal, and reopen the same file. They are not exceptions, simulated restarts or graceful closes presented as process-kill evidence.

| Plan requirement | Observed result                                                                                                                                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EP04-T01         | SIGKILL immediately before COMMIT leaves only the original opening operation, unchanged stock, both original queues and an unconsumed cart. SIGKILL after COMMIT retains the sale, one tender, both queues, attachment job and consumed cart. Retrying returns the original receipt and exactly one sale effect.     |
| EP04-T02         | Faults at journal, projection, tenders, peer outbox, cloud outbox, draft consumption, attachments, local receipt readback and precommit all roll back. Reopen/retry produces gross 500, stock 9 from opening 10, one tender and matching queues. A lost response after actual COMMIT preserves the original receipt. |
| EP04-T03         | Two independent connections submit the same operation and draft revision simultaneously. One fresh commit and one duplicate return equal receipts, one tender and two destination references. Competing draft edits admit one revision only.                                                                         |
| EP04-T04         | SQLite `query_only` produces a real readonly write denial during opening autosave. Reopening retains revision 1 with counted zero; a later committed uncounted value remains a distinct state. The separate SIGKILL tests cover durable cart state.                                                                  |
| EP04-T05         | A v1 migration fixture retains immutable pending evidence through successful v2 migration and an interrupted v2 statement. Interrupted DDL and user_version roll back together; reopening and retry preserve the pending row. A newer database version is refused without clearing records.                          |
| EP04-T06         | Account, business and installation changes, lock and sign-out deny readiness, draft, queue and diagnostics access. Restoring the original identity recovers retained records. A switch during authorization aborts the transaction.                                                                                  |
| EP04-T07         | Each independent connection reports foreign_keys=1, journal_mode=wal and synchronous=2. Orphan outbox writes fail through raw access, write transaction and read-transaction helpers on both connections.                                                                                                            |

Additional independent regressions verify matching authenticated receipt adapters, strict receipt digest matching, separate peer/cloud acknowledgements, retained failed cloud attempts, immutable original remote receipt timing, changed-payload conflicts, bounded redacted diagnostics, and readiness refusal when cached gross/stock are corrupted while journal sequence and seen IDs remain intact.

Expected values are literals from the independent one-product fixture: opening cash 1000, one product at 500, cash tender 1000/change 500, opening cups 10 and remaining cups 9. The reducer does not compute test expectations. Root's full golden-shift integration is separate evidence.

## Source review

Reviewed the root-owned additive migrations and final connection, migration and repository source. Every connection configures and verifies its own SQLite pragmas. Writes use BEGIN IMMEDIATE and bounded busy retries. Snapshot, operation, tender and receipt evidence has immutable SQL triggers; scope and child foreign keys bind the actual tables. The transaction combines journal, projection, tender, queues, draft marker and attachment references, with no success returned before COMMIT.

The required constructor-injected authority is an explicit boundary. Tests use synthetic local authorization and structural signature fixtures; they do **not** establish secure device enrollment or Ed25519 authenticity. There is no permissive production authority default. Readiness reconstructs the projection through trusted historical authorization, verifies original tenders and queues, and bounds metadata/journal reads. Native Expo adapter source opens/configures its own connection; its installed-device behavior has not been executed here.

## Executed checks

From repository root unless stated otherwise:

| Command                                                                                                                                                                                                      | Result                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `corepack pnpm --filter @miniros/mobile exec vitest run tests/ep04-review`                                                                                                                                   | PASS, 3 files, 28 tests, no failures/skips                           |
| `corepack pnpm --filter @miniros/mobile typecheck`                                                                                                                                                           | PASS                                                                 |
| `corepack pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --skipLibCheck --esModuleInterop --types node,vitest/globals tests/ep04-review/*.ts` from `apps/mobile` | PASS; independently includes test files excluded by the app tsconfig |
| `corepack pnpm exec eslint apps/mobile/tests/ep04-review apps/web/src/test/native-v2-review`                                                                                                                 | PASS; existing root Next pages-directory configuration warning only  |
| `corepack pnpm exec prettier --write apps/mobile/tests/ep04-review apps/web/src/test/native-v2-review`                                                                                                       | Completed                                                            |

## Outstanding environment gates

Desktop SQLite integration and OS SIGKILL are I evidence. Android/iOS native compilation, physical Expo SQLite termination/cold launch, phone storage exhaustion, flash/power failure, background suspension and lock-screen transitions have not been verified. The D portions of EP04-T01/T04 and applicable physical storage gate remain blocked. No phone success, hosted environment success or rollout approval is inferred from this acceptance.
