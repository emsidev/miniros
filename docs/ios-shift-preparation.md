# iOS shift preparation repair

Implemented locally on 14 September 2026. **Not approved for production release.** Physical iPhone Safari and Home Screen acceptance is still pending. The reported iOS 18.4.1 failure has not been inspected on its original device; this repair addresses reproducible weaknesses in the preparation path without claiming its exact cause.

## Behavior and boundaries

Scheduled shift details render without preparation or reservation. Opening **Start shift** runs the shared readiness coordinator. Preparation, opening-count loading and start confirmation all use it; there is no online bypass.

The coordinator deduplicates concurrent attempts of the same contract, waits up to 15 seconds for each worker reply, and limits installation/check/repair/update recovery to 60 seconds overall. It closes message ports and removes timers and event listeners. Cache operations and fetches are bounded even when their underlying promises stall. Downloads run in batches of four; a batch settles before another repair or update starts.

Readiness replies retain `ready`, `version` and `contractVersion` and add `missingFiles`, `durationMs`, `code` and `error`. Legacy replies still work. Errors distinguish installation, cache, timeout, storage, build and protected-update failures. Preparation failures expose diagnostics under **Setup details** and a useful next action. **Retry setup** repairs before verifying again. No recovery flow suggests clearing website data.

Each new worker embeds its complete generated asset list. It rejects a missing, malformed, truncated or mismatched manifest; validates HTTP success, redirects and the shell's Next build ID; and rechecks all files before publishing its cached manifest. The build emits a frozen public `/pwa-shell.html` with a build marker and a matching versioned manifest. Its marker must agree with the embedded Next Flight build ID.

Repair opens only the worker's named build cache. Before downloading missing files, it verifies that the network manifest matches that worker. A changed deployment or removed old asset triggers a guarded update instead of mixing builds. Verified public responses use `ignoreVary` when read; repair normalizes their saved `Vary` headers for older workers. This addresses transport-header cache misses but is **not yet established as the failing iPhone's cause**.

Waiting updates activate through the existing saved-work guards. Unfinished prepared shifts, pending actions/proofs and checkout drafts prevent activation. A compatible current build is repaired and fully verified before considering a waiting update; saved work continues on that complete build if the guard prevents activation. Incomplete or incompatible builds still require successful recovery. Recovery deletes no build caches, installation identity, drafts, proofs or journals. Older hashed assets remain available to existing tabs; readiness verifies the current worker's own complete cache.

Reservation occurs only after readiness. Preparation saves the session and reads it back with shift/account/device/installation identity checks before opening counts. The optional storage-persistence permission no longer holds a successfully saved shift behind an unanswered browser prompt. Existing preparation API, journal contracts, employee design system and business rules remain intact. No database migration was added. Asset coverage remains the complete emitted JS/CSS/font set.

## Repeatable checks

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @miniros/web exec vitest run src/test/service-worker.test.ts pwa/sw.test.ts src/lib/offline/readiness.test.ts src/lib/offline/app-update.test.ts src/lib/offline/prepare.test.ts src/lib/offline/opening-draft.test.ts
pnpm --filter @miniros/web typecheck
pnpm --filter @miniros/web lint
pnpm --filter @miniros/e2e typecheck
pnpm --filter @miniros/e2e lint
pnpm --filter @miniros/e2e test
pnpm --filter @miniros/web build
pnpm --filter @miniros/e2e exec playwright install chromium firefox webkit
pnpm --filter @miniros/e2e test:browser
```

Browser tests use the production Next server on port 4320 and an isolated, loopback-only harness on 4321. The harness bundles the actual readiness/storage/count/sync modules, serves production worker/assets/CSS and uses real browser IndexedDB. Its preparation/status/sync API is simulated with disposable, installation-scoped shifts. It never forwards financial mutations to production. Do not publish the harness or its synthetic legacy workers. Restarting it discards simulated server sessions, which can invalidate the fixture's authentication status while retaining local saved records.

The Brave project defaults to its macOS application path; Chrome uses its installed channel. Run `--project=chromium` on hosts without those apps. Playwright's service-worker instrumentation is Chromium-specific; WebKit is used only for rendering, never as Safari readiness acceptance. [Playwright service-worker documentation](https://playwright.dev/docs/service-workers).

## Evidence from this implementation

- Targeted readiness/worker/preparation/opening/update suites: **49 tests passed**.
- Existing disposable workflow and Dexie integration suites: **37 tests passed**. They exercise the real preparation/replay services against disposable database fixtures; hosted authentication and Storage are not established by them.
- Final production build **sAa7fTzX5YScYzLl-Fs8w**: **134 static assets**, all emitted JS/CSS/fonts retained. Worker, network manifest and frozen shell versions match.
- Final browser matrix: **18 tests passed** (11 Chromium worker/core cases, 2 installed Brave, 2 installed Chrome, 2 Playwright Firefox, 1 WebKit rendering case). Core checks cover evicted-asset repair, offline cold launch, durable opening drafts, sale, inventory movement, closeout and duplicate-safe replay. Chromium additionally covers first-install interruption/retry, stale and waiting workers, protected saved work, interrupted repair, quota failure, repeated taps, an eight-second reply, opening-confirmation failure/retry, failed durable readback, and continued verified work after a guarded waiting update.
- Real desktop Safari **18.6**, fresh isolated origin on port 4323: first installation verified **miniros-sAa7fTzX5YScYzLl-Fs8w**, contract **2**; an evicted asset repaired and reverified the same build; durable disposable preparation reached the actual **Opening count** screen. This is a simulated server session, not a production account transaction.
- UI checks: production CSS at 360, 375, 768, 1024 and 1440px; no document overflow; retry target at least 48px high; accessible heading/alert/details; reduced-motion spinner computed as `animation-name: none`. Actual opening confirmation showed a repair/storage alert, retained entered stock/cash, stayed prepared, then started on retry.
- Impeccable changed-surface detector: no findings. Rams quick and full reviews ran. Full review returned **59/100** and its free verification did not clear findings. The claimed missing reduced-motion support and swallowed submission rejection are contradicted by the explicit motion classes and browser checks above; submission rejects into the shared workflow's inline alert. Raw generic preparation errors now have recovery guidance and separate diagnostics. Two style findings concern the existing closed-shift inverse card and close-button weight; these were retained to honor the requested design scope. No clean Rams score is claimed.
- Web lint, web/e2e typechecks and production build passed. The full web test run is **not green**: existing native database suites need `SHIFT_TEST_DATABASE_URL` and an available PostgreSQL test server (default localhost:55432). Those checks were not bypassed or changed.

Browser/application versions inspected on this Mac:

| Surface                     | Version                              | Evidence scope                                                                                                                        |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Native Safari               | 18.6                                 | Actual desktop worker repair, durable fixture preparation and opening counts                                                          |
| Brave                       | 153.1.95.101, Chromium 153.0.8010.37 | Automated installed application, isolated contexts                                                                                    |
| Google Chrome               | 153.0.8010.37                        | Automated installed official application, isolated contexts                                                                           |
| Playwright Chromium         | 153.0.8010.12                        | Production worker lifecycle/fault tests                                                                                               |
| Playwright Firefox          | 155.0                                | Instrumented browser regression, page-level cache/IndexedDB checks                                                                    |
| Native Firefox              | 155.0.1                              | Actual desktop installation, missing-file repair, durable fixture preparation, opening counts and offline cold launch; draft retained |
| Playwright WebKit           | 26.6                                 | Rendering/accessibility only                                                                                                          |
| iPhone Safari / Home Screen | Target iOS 18.4.1                    | Mirroring baseline inspected: Safari workspace load error; Home Screen app signed out. Repaired-build acceptance pending              |

Official Chrome and Firefox applications were downloaded from their vendors. Playwright browsers were installed through its package tooling. Browser contexts use distinct disposable shifts and storage containers.

### Mirrored-device baseline, 14 September 2026

The physical iPhone was available through iPhone Mirroring. Its existing Safari tab at `miniros-web.vercel.app` displayed “Something went wrong — We could not load this workspace. Check your connection and try again.” Launching the existing MINIROS Home Screen app displayed the public landing page and Sign in. These are separate storage/auth containers; neither observation establishes the reported readiness failure. No website data was cleared, no shift was reserved and no update was activated. Worker/controller versions, reply timings and cache errors still require Web Inspector. Phone tap automation returned `noWindowsAvailable`; keyboard Spotlight navigation worked. Mac Safari inspection stalled while enabling developer features, so that setting and device inspection are unverified.

Native Firefox **155.0.1** used a fresh loopback test origin on port 4324. The actual production worker verified build `miniros-sAa7fTzX5YScYzLl-Fs8w`, contract 2, repaired an evicted asset and reverified. The real local preparation code committed a disposable simulated session and reached Opening count even with optional persistent-storage permission denied. After entering 10 cups and ₱500 cash, Firefox Work Offline plus a new tab cold launch restored the saved review draft and displayed Offline. This does not establish hosted provider or physical iOS acceptance.

## Required physical iPhone gate

Before repair, reload, update activation or any storage change on the failing device, connect it to the Mac and inspect its current Safari tab. Enable iPhone Safari Web Inspector and the Mac Safari developer features, then select the device/tab in Safari's Develop menu. Inspect the Home Screen app separately because its storage and worker can differ. Follow [Apple's iOS inspection guide](https://developer.apple.com/documentation/safari-developer-tools/inspecting-ios).

Record device model, iOS/browser version, URL, timestamps, worker/controller script URLs, active/installing/waiting states, worker/cache build versions, contract version, reply duration, missing paths, cache exceptions and default-vs-`ignoreVary` misses. Keep account/session identifiers private in shared evidence. A non-mutating worker diagnostic in the selected page's console:

```js
const registration = await navigator.serviceWorker.getRegistration("/");
console.log({
  browser: navigator.userAgent,
  controller: navigator.serviceWorker.controller?.scriptURL,
  active: registration?.active?.scriptURL,
  waiting: registration?.waiting?.scriptURL,
  installing: registration?.installing?.state,
});
const started = performance.now();
const report = await new Promise((resolve, reject) => {
  const channel = new MessageChannel();
  const cleanup = () => {
    clearTimeout(timer);
    channel.port1.close();
    channel.port2.close();
  };
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error("No worker reply in 60 seconds"));
  }, 60000);
  channel.port1.onmessage = (event) => {
    cleanup();
    resolve({ ...event.data, measuredMs: performance.now() - started });
  };
  if (!registration?.active) {
    cleanup();
    reject(new Error("No active worker"));
    return;
  }
  try {
    registration.active.postMessage("CHECK_OFFLINE_READY", [channel.port2]);
  } catch (error) {
    cleanup();
    reject(error);
  }
});
console.log(report);
console.log({ cacheNames: await caches.keys() });
```

Do not clear website data. Inspect cache read failures separately from worker installation/controller failures and reply timeouts. The baseline inspection must precede testing the new repair on the original failing storage container.

Use a secure staging/preview build and isolated test shifts for each Safari/Home Screen container. Complete all of the following before production release:

1. Start shift after automatic repair reaches opening counts; verify the saved session and actual worker build.
2. Test first installation, stale/waiting worker, deleted chunk, reply later than five seconds, interrupted download, storage failure, repeated taps and failed session readback.
3. Enter opening counts/cash, cold-launch offline, record a sale and inventory movement, close out, terminate/reopen, reconnect and compare duplicate-safe server effects to the journal.
4. Verify installation identity, saved shifts, count/checkout drafts, proofs and journals survive repair and protected updates.
5. Check mobile keyboard/focus, screen-reader error announcements, touch targets, reduced motion and zoom. Record evidence separately for Safari and Home Screen.

Production release remains blocked until those physical acceptance checks pass. Local browser fixtures do not prove hosted Supabase auth/Storage, real financial replay, or iOS behavior.
