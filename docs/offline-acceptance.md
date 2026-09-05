# Offline acceptance evidence and device checklist

Initial implementation verification date: 5 September 2026. The automatic-readiness update enables every location and prepares the selected shift when Start shift opens. No hosted migration or real business transaction is required for these checks. Earlier evidence below describes the original implementation; the automatic-readiness verification is recorded separately.

## Repeatable automated checks

From the repository root:

```sh
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm e2e
corepack pnpm --filter @miniros/web build
corepack pnpm --filter @miniros/web start --port 3100
MINIROS_PREVIEW_URL=http://localhost:3100 corepack pnpm e2e
```

The existing e2e workspace now contains a disposable PostgreSQL/PGlite workflow suite. It applies the actual business schema/RLS/migrations to an empty database and drives the real preparation, replay, sales, inventory, review and closeout services together with Dexie actions. Auth identity is a test seam; this does not prove a hosted Supabase login session, multiple PostgreSQL connections or physical browser behavior. No test uses the user’s hosted business data.

Verified scenarios include:

- Prepare at any location with missing, disabled, or legacy pilot records; a second installation is rejected, including a different storage container using the same authentication/installation cookie.
- Local start → sale → closeout survives database close/reopen, preserving action sequence and projections.
- Competing local database connections deduplicate double taps; changed action IDs/payloads conflict.
- A failed local proof write rolls back the action and projection.
- Local account isolation hides retained records after identity loss/change.
- Positive pending adjustments do not manufacture sellable stock; overselling rolls back.
- Changed catalogue prices/costs do not change replayed sale values.
- Repeated acknowledgements do not duplicate sales, cash, inventory or closeout.
- Original start/end times, final stock, exact cash/change and profit match the fixture.
- Missing sequences, invalid clocks, revoked-access response and ordinary writes to a reserved shift are rejected.
- Closeout is sealed while reviews are pending; approved cash deductions feed its final result.
- A missing proof link blocks finalized profit. A simulated lost Storage upload acknowledgement is recovered by verifying the saved bytes; repeated upload after closure returns the original proof link.
- A failure to commit the synchronization journal rolls back the sale’s business effects too.
- Direct browser reads of prepared snapshots and journal writes are denied by database grants.
- The worker falls back from installed root/operational URLs, excludes authenticated API/admin pages, and withdraws readiness when an asset is missing or installation is interrupted.
- Against the production HTTP server: install manifest/PNG signatures, public shell routes, generated worker/cache headers and cross-origin mutation rejection.

The existing optional real-PostgreSQL shift-planning tests use `SHIFT_TEST_DATABASE_URL`; they remain skipped without that separate test database. Some other workspace packages still have pre-existing placeholder test commands. Passing the repository command is not proof that those packages have suites.

## Browser observations

Production Next.js 15.5.19 build, Codex in-app browser on macOS; default desktop width and 390 × 844 viewport.

- Install page rendered; **Check offline files** reported the app files ready.
- Help and Sync routes navigated and resolved their loading/empty states.
- Existing signed-in owner account reached its business selector and dashboard through normal navigation; no business records were changed.
- Setup checklist reflected current business records. Mobile **All business tools** expanded and exposed owner destinations plus Help/Install/Sync.
- Measured document width equalled the 390px viewport. Installation and menu screenshots showed no horizontal clipping.
- Viewport metadata retained `width=device-width, initial-scale=1` with no zoom prohibition.
- No warning/error entries were captured on the inspected public pages and dashboard.

This is a production-page smoke check, not a completed authenticated browser transaction suite. Keyboard operation of the new menu, browser zoom at 200%, full sale/proof/closeout screens on devices, offline network recovery and install-to-home-screen behavior still need the staging/device run below.

## Required staging and physical-device run

Record device model, OS, browser version, app build ID, business/location, operator, session ID, time and observed result for every run. Use the installed app to prepare its own data. The in-app browser is not an Android Chrome or iPhone Safari substitute.

| Acceptance run                                                                                                                                                     | Status                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Physical Android Chrome: install, launch, close and relaunch                                                                                                       | Not performed                                                              |
| Physical iPhone Safari: Share → Add to Home Screen/Open as Web App, then prepare inside the installed app                                                          | Not performed                                                              |
| Prepare online → airplane mode → cold launch → opening counts → several cash/non-cash/split sales with proofs → requests → closeout → terminate/reopen → reconnect | Not performed                                                              |
| Compare exact server sales/items/tenders/change, stock events/counts, occurrence times and final location profit to the original records                           | Automated fixture passed; physical run pending                             |
| Double taps, lost acknowledgements, competing tabs and second device                                                                                               | Automated coverage; multiple physical browsers/connections pending         |
| Disable access while disconnected, expire login, reauthenticate same account and recover work without leaking another account’s records                            | Auth boundary/local isolation covered; real-session run pending            |
| Change product prices/recipes/costs after preparation                                                                                                              | Frozen-price fixture passed; full configuration/device matrix pending      |
| Pending reviews and unavailable proof attachments prevent finalization                                                                                             | Automated barrier coverage; real Storage upload/retry pending              |
| Quota failure, interrupted application update and cache eviction never falsely report a completed action/ready shift                                               | Automated local/worker fault coverage; physical storage/update run pending |
| Owner freeze, compare original records to the journal, restore original device and resolve a conflict                                                              | Controls implemented; staging operational drill pending                    |
| Permanently lost device with unknown unsynchronized sales                                                                                                          | Remains blocked/provisional; no automatic write-off or data reconstruction |
| Mobile menu, keyboard, 200% zoom, validation messages and receipt recovery                                                                                         | Partial browser smoke; full acceptance pending                             |

Offline support is automatic at every location. Complete the device checks before production release. Do not mark a location recommendation final to bypass unavailable records or attachments. If a physical device or its storage is gone, document what can and cannot be recovered and leave that shift unresolved until the owner reconciles the original evidence.

## Implementation check results

Original implementation: repository type checks, lint and tests passed. The optional real-PostgreSQL planning cases were skipped because `SHIFT_TEST_DATABASE_URL` was not supplied. The original offline suite had 20 non-HTTP checks plus 3 production HTTP checks enabled with `MINIROS_PREVIEW_URL`. The web production build emits the versioned worker and its static asset list. Physical-device rows above remain unverified.

## Automatic preparation and Devices verification — 5 September 2026

- Web: **140 tests passed; 12 optional real-PostgreSQL cases skipped**. Web type checking and lint passed.
- Workflow/production HTTP: **45 checks passed** with `MINIROS_PREVIEW_URL` pointing to the isolated local production build. E2E workspace type checking and lint passed. These include existing shared offline suites, not 45 newly added tests.
- Production PWA: Next.js **15.5.25** build passed and emitted a versioned worker with **120 static assets**, excluding private pages. Builds used an isolated temporary copy so the running development app's build files were not overwritten. `git diff --check` passed.
- Added coordinator/draft coverage: readiness before reservation, duplicate mounts, failed local save and readback, retry after a lost response, durable expressions/notes/review step, cross-tab start IDs, transactional start failure and retry, and exact offline URL matching including conflicting session/shift targets.
- Real authorization policy tests deny operators access to device listings, journals, freeze and restore; deny signed-out users; and allow owner/admin policy checks. Workflow fixtures verify business isolation, acknowledged activity, attention ordering, freeze/restore journal retention, universal location support despite legacy pilot records, and historical start retries.
- Production browser smoke: signed-in Settings retains This device and removes all pilot/recovery controls; desktop and mobile navigation expose Devices and Settings; Devices displays the specified empty state. No real shifts were reserved, frozen, started, or sold into during browser verification.
- Disposable browser UI fixture: actual Devices and opening-count components with production CSS, mocked recovery/network readiness, and real IndexedDB storage. Verified All/Needs attention, linked details, collapsed technical activity, recovery-note validation, freeze/restore feedback, and keyboard opening/dismissal/focus return. `12 + 6`, notes and the review step survived reload; confirming start committed locally and remained started after reload. This fixture does **not** establish production service-worker readiness or real server synchronization.
- Layout: Settings and Devices checked at **360, 768, 1024 and 1440px**, with no measured horizontal document overflow. Opening counts/review checked at these widths in the disposable fixture. Mobile stacks and desktop rows were visually inspected. Keyboard-visible focus, review heading focus, recovery dialog focus and the mobile Devices menu destination were checked.
- Reduced-motion safeguards are present in global CSS and readiness/refresh indicators use `motion-safe`; actual OS reduced-motion interaction was not exercised. The browser tool did not support the attempted zoom shortcuts, so **200% browser zoom remains unverified**.

Outstanding release checks: physical Android/iPhone installation, actual production offline cold launch through sales/proofs/closeout/reconnection, real multi-browser connections and hosted auth/Storage, 200% zoom, and the OS reduced-motion setting. The disposable database and browser fixtures are not substitutes for that staging/device run. Development mode intentionally remains without the production service worker; there is no online-only start bypass.
