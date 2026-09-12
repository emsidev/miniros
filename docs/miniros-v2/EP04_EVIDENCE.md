# EP04 evidence — crash-safe SQLite storage

Local baseline `0056f316cf811f10f943d56c4c987b1642844938` plus this diff, 7 September 2026. EP04 portable storage integration is independently accepted. Physical native G2 evidence remains blocked.

Implementation and exact test details: EP04_PERSISTENCE_REPORT.md. Independent findings and acceptance: EP04_REVIEW_REPORT.md. Migration/rollback instructions: EP04_EP05_MIGRATIONS.md. Frozen arithmetic/API: EP03_CONTRACTS.md.

## Actual results

`corepack pnpm --filter @miniros/mobile test` passed **123 tests in seven files, zero failures/skips**: EP02 69, EP04 author 26, EP04 independent reviewer 28. `evidence/ep04-mobile-tests.log` records the aggregate run. Native typecheck and lint pass; root force checks are in `evidence/ep05-root-{typecheck,lint}.log`.

The tests use real file-backed SQLite 3.53.3 on Node 24.19.0. Real child processes receive SIGKILL immediately before/after commit; separate actual connections compete or hold locks. Fault tests include SQLITE_FULL, read-only/query-only write denial, interrupted additive migrations and a failed count autosave followed by process termination. Every failed transaction preserves the last committed draft and avoids a false saved receipt.

| Acceptance ID | Result                                                                                                                       | Remaining gate                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| EP04-T01      | PASSED I: real process kill before/after sale COMMIT; absent or fully present with projection/tender/both queues/cart marker | BLOCKED D: installed native app kill/relaunch   |
| EP04-T02      | PASSED I: each transaction boundary failure rolls back journal, stock, tenders, outboxes, draft and media references         | None for I                                      |
| EP04-T03      | PASSED I: competing connections produce one effect and identical original receipts                                           | None for I                                      |
| EP04-T04      | PASSED I: autosave write denial, process kill and reopen retain committed zero/uncounted/packing state                       | BLOCKED D: installed native autosave/cold-start |
| EP04-T05      | PASSED I: actual migration-v1 pending records survive interrupted v2 migration and retry                                     | None for I; no destructive downgrade            |
| EP04-T06      | PASSED I: account/business/installation change or explicit lock denies foreign reads and retains pending evidence            | Future enrollment/key lifecycle is EP07         |
| EP04-T07      | PASSED I: foreign keys are configured and checked on every real connection; scoped orphan writes fail                        | None for I                                      |

The root integration test `apps/web/src/test/v2-golden-integration.test.ts` saves the full 19-operation golden shift in SQLite while PostgreSQL remains at sequence zero, closes with pending media, reopens the file, and uploads every operation with a lost-response retry. All original local/cloud receipts match, cloud and local projections are identical, cloud pending becomes zero, peer pending remains 19 and four media jobs remain independent. This is I evidence, with only hosted Bearer validation stubbed in-process; it is not a native transport or hosted Auth result.

## Review and limits

Independent review accepted the implementation with no remaining source finding. Root review additionally requested a precommit journal capacity limit, bounded/paged readiness and immutable draft kinds; these were implemented and tested. Readiness reconstructs the projection and validates original tender contents rather than trusting only sequence counters.

Storage authority/signature checks are mandatory injected adapters; there is no permissive production default. The current module does not implement EP07 enrollment or protected native private-key storage. The cashier-only financial peer outbox is not wired to EP02 transport and is not a plaintext prep mirror. No POS UI or EP06+ workflow was added.

Missing Java/JDK, Android SDK/adb, full Xcode, CocoaPods and test phones block native compilation and D checks. Desktop SQLite/OS process-kill tests cannot substitute for native flash, app suspension, platform backup or power-loss evidence. Retain files on migration/readiness failure; no reset/recreate recovery path exists.
