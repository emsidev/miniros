# Test strategy and release gates

## Evidence levels

**U — Unit/property tests:** pure domain math, state transitions, schemas, deterministic seeds.
**I — Integration tests:** real local storage/server services with controlled faults; SQLite and PostgreSQL behavior must be tested with their actual engines where relevant.
**W — Running web/native UI automation:** actual components/routes with user interactions; fixtures/mocks disclosed.
**D — Physical-device test:** installed native builds on named real phones. A simulator or responsive browser screenshot is not D evidence.
**S — Hosted-staging test:** isolated authorized Supabase Auth/Storage/Realtime plus native client, with separate secrets and disposable business data.
**P — Staff pilot:** real two-person rehearsal and then an authorized controlled business trial with reconciliation.

Each execution plan has test IDs `EPxx-Tnn`, arranged as setup/failure → expected result. Implement automated cases as code, not only prose. Map each ID to the file/test name and evidence. The pack is a specification, not a claim these app tests have passed.

## Baseline commands to verify before use

The inspected root `package.json` declares pnpm 10.2.1 and these scripts [R3]. Honor the actual checkout's engines/lockfile; do not upgrade frameworks during the redesign without a concrete compatibility need.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm e2e
corepack pnpm --filter @miniros/web build
git diff --check
```

Inspect environment requirements first. Run builds in isolation from an existing development server. `pnpm e2e` currently invokes a Vitest workflow suite, not a real mobile driver [R5]. `@miniros/mobile test` currently prints “No mobile tests yet,” and its build exports web [R4]. Replace/add truthful scripts for real mobile unit/integration and native Android/iOS builds; list their exact commands after implementation. Do not invent already-existing `test:mobile`/`test:device` commands in reports.

The acceptance document uses optional `SHIFT_TEST_DATABASE_URL` and `MINIROS_PREVIEW_URL`. A skipped optional PostgreSQL suite remains skipped; fail required CI jobs when their promised suites execute zero tests. Run host-specific checks only against verified disposable endpoints. The root `db:migrate` invokes `supabase db push`: do not run it as a routine local test [R3]. A local migration command is safe only after confirming the target.

Focused tests run per slice; affected-workspace lint/typecheck/tests run at every integration checkpoint. Full repository gates and native builds run before a release candidate. Report unrelated baseline failures instead of hiding them or widening the change into an unrelated rewrite.

## Mandatory gate sequence

| Gate | Evidence | Cannot proceed to |
|---|---|---|
| G0 — Baseline truth | EP00: checkout and command inventory, preservation strategy, known failures/test gaps | Broad implementation without an understood baseline |
| G1 — Transport feasibility | EP02: protocol test harness plus actual Android/iOS combinations, permissions and reconnect evidence | Claiming/supporting the selected production peer transport |
| G2 — Local correctness | EP03/04/07–12/15: golden fixture, atomic saves, replay, counting and local whole-shift test | Controlled customer pilot |
| G3 — Cloud/security correctness | EP05/13/14: idempotent ingestion, hosted auth/RLS/media and freshness tests | Owner dashboard described as reliable/live |
| G4 — Recovery/closeout | EP15/16/18: exact reconciliation, QR duplicate safety, migration/rollback drill | Cutover or deletion of legacy paths |
| G5 — Usability/device readiness | EP17/19: full phone matrix, full-length soak, independent review, staff rehearsal | Production release |
| G6 — Owner authorization | Explicit release/pilot authorization and rollback owner named | Deployment or production migration |

A blocked physical gate does not forbid writing portable reducers/UI behind a development flag. It forbids declaring the capability proven or making dependent production commitments. Real signed builds are required before staff distribution; lack of signing access is a recorded external gate, not a reason to substitute web export silently.

## Fault matrix applied across plans

Run at least: loss of internet only; loss of local peer only; loss of both; captive-portal/backend error despite a network icon; duplicate requests; lost acknowledgement after commit; out-of-order messages; permanent invalid payload; interrupted local transaction; disk-full/write denial; app kill/reboot; lock/background/foreground/phone call; token expiry; explicit revocation; account switch; frozen catalog edited remotely; stale template; clock moving backward; slow/failed media; partial QR scan; duplicate cloud/QR import; device loss; old-client queued operations after migration.

For each, assert local receipt truth, peer receipt truth, cloud receipt truth, monetary/stock invariants, preserved audit evidence and understandable UI. Do not accept “did not crash” as the whole assertion.

## Physical test envelope and proposed performance targets

Record exact phone model, OS, radio permissions, native app/build and protocol versions, battery/power state, storage condition, venue/test environment, cashier/prep roles, and network state. Cover Android–Android, iPhone–iPhone, Android cashier/iPhone prep, and iPhone cashier/Android prep. Use both roles in mixed pairs. Offline tests disable internet independently of the local radios; airplane mode with every radio disabled is a different failure scenario.

Proposed targets, not measured guarantees: p95 local saved feedback ≤300 ms; healthy foreground peer durable receipt ≤1 second; healthy foreground owner update ≤5 seconds; automatic healthy-link catch-up within 10 seconds after both devices return to an operational state for a small pending batch. Measure at least 100 operations for latency percentiles, report p95/max/sample size, and document failures. Revise targets only with measured evidence and a recorded product decision, never simply to turn a failing test green.

Run a full-length rehearsal (target eight hours) with at least 500 mixed transactions, adjustments and reconnects; additionally a deterministic 3,000-operation stress stream and at least 20 disconnect/duplicate/lost-ack cycles. Keep sizes configurable and include the maximum intended pilot catalog. Report battery/thermal behavior rather than promising all devices last a shift. Mobile OS background suspensions may defer communication; resume behavior and truthful pending states are mandatory.

QR test: representative maximum closing journal, declared missing attachments, repeated/missed frames, glare/low brightness, foreign package, tampered digest/signature, interruption and app restart. Measure actual payload/transfer behavior and document a supported envelope; no promise that arbitrary shift data fits one static QR.

## Independent arithmetic oracle

Use `fixtures/golden-shift.json`. Prices/recipes are synthetic test values, not Bettercup's live menu. The golden expected numbers must be reviewed independently of the reducer implementation. Replay the same events locally, on the server, after restart, through repeated uploads and QR import; all projections must match the fixed expected output. Add a second tenant and assert every cross-tenant access fails.

Use seeded property tests for balanced tenders, bounded refunds, non-negative allowed stock, idempotency, immutable snapshots, and event-order equivalence where operations commute. Separate test transport simulation from native transport tests. Never use the production reducer to generate the expected numbers it is being tested against.

## Evidence template and CI

Use `templates/EVIDENCE_TEMPLATE.md`. Store short redacted summaries in version control; store large logs/builds/screenshots as CI/local artifacts with checksums. No secrets, customer names, tokens, payment photos, or QR capabilities in published logs.

CI should enforce unit/integration suites, type/lint/format gates, migration compatibility and RLS tests, web build, Android native build, and an iOS build on a suitable runner. Hosted/physical suites may use separately approved runners; their absence must block the release job. Cache dependencies safely, pin existing supported versions, and list skipped jobs accurately. Add failure artifacts, deterministic seeds and cancellation cleanup for test databases/devices.
