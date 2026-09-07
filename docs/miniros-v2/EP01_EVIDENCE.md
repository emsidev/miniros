# EP01 evidence — development contract and walkthrough only

Source: EP00 checkpoint `657a6c28eeeeeac2bc119fa7c5ab1d90cdfe93b6` + EP01 diff
on `dev`, 2026-09-07. macOS / Node 24.19.0 / pnpm 10.2.1; Next 15.5.25.
Browser: isolated Chrome headless 152.0.7977.54 via Playwright 1.58.2, local port 3101. Initial smoke used agent-browser 0.36.0. Fixture-only
React memory state, no application API/storage calls. U + W + Review; no D/S/P.
Existing schemaVersion 1 unchanged; v2 envelope is a conceptual type only.

| ID       | Test/evidence                                                                                              | Result                                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EP01-T01 | `packages/contracts/tests/staff-workflow.test.ts`; `corepack pnpm --filter @miniros/contracts test`        | PASS: 105 new assertions/cases + 1 retained test = 106 passed, zero failed/skipped. Independent expected graph covers all 81 state pairs, competing claim/epoch, illegal skips, sealed counts and stale prep transitions.            |
| EP01-T02 | `node scripts/acceptance/ep01-browser.mjs` (runner environment below) against running opt-in Next route    | PASS (W): required schedule fields exactly date/planned open/planned close/venue/address/cashier/prep, no allocation; setup separate                                                                                                 |
| EP01-T03 | same running browser script                                                                                | PASS (W): blank, counted zero, Not brought, unresolved count, validation/interrupted input and explicit review                                                                                                                       |
| EP01-T04 | REQUIREMENTS_TRACEABILITY.md expanded §1–8 clause groups; WORKFLOW_CONTRACTS mapping; independent reviewer | Source review accepted: every clause group has accountable owner and existing verification IDs. Automated cross-check: all 101 referenced IDs exist in TEST_CASE_INDEX.json. Future references are obligations, not completed tests. |
| EP01-T05 | ARCHITECTURE_DECISIONS.md ADR01–09; independent reviewer                                                   | Source review accepted: Expo retained; native/transport/camera/crypto remain explicit EP02/later gates; no pure-PWA mixed-phone or homemade crypto claim                                                                             |

Additional safeguards: `development-skeleton.test.ts` and
`application-providers.test.ts`: 2 passed, zero failed/skipped. Production denies the
route even with flag 1; normal routes retain legacy device/PWA providers. Exact dev
walkthrough omits those providers to avoid legacy journal access.

## Runnable scope

`MINIROS_V2_SKELETON=1 corepack pnpm --filter @miniros/web dev --port 3101`, then
`http://localhost:3101/dev/workflow-skeleton`. Off by default and denied in production.
Owner Setup/Schedule, staff Join/Pack/Count/Sell+Prep/Close are navigable fixture views.
Navigation selects a demonstration stage, not an accepted workflow transition; actions
call the shared guards. Reload discards fixture memory. No actual schedules, shifts,
sales, stock, grants, receipts, snapshots or uploads are created.

Loading, missing catalog, offline and interrupted-save states are selectable;
validation faults come from actual input. Missing supplies block departure; equipment
is kept out of inventory count examples. The owner does no product/stock allocation.
Preparation is automatic in the adopted product contract; the skeleton previews it,
and does not implement generation/caching/enrollment (EP07).

## Review findings and resolution

- Lead: first UI mixed equipment/cash into inventory and permitted missing supplies;
  corrected to inventory-only examples, separate supplies and guarded resolution.
- Lead: retained invalid/interrupted text and blocked opening until it is corrected;
  review confirmation resets after edits. Initial offline preparation rejects.
- Independent reviewer P2: exhaustive tests used the production graph as their oracle.
  Replaced with test-owned expectedEdges and separate graph equality check; 106 pass.
- First browser smoke hit a temporarily absent module during an implementer rewrite;
  retry after completed file loaded correctly with zero browser errors.
- CLI harness exposed selector quoting/dropdown support and controlled-input clearing limitations. Replaced that temporary harness with Playwright, corrected case-sensitive accessible-name matching, and reran the same acceptance assertions. No application assertion was weakened.
- Integration lint found React children-prop usage in the new provider test; switched to createElement child arguments and reran lint.

## Integration and release

Final browser run: **29 named assertions + 6 value/API/error assertions passed**.
No browser errors, framework overlay or application API requests. Count page had no
horizontal overflow at 360/768/1280px. Lead visually inspected running owner and count
screens; screenshots retained locally at `/tmp/miniros-ep01-owner.png` and
`/tmp/miniros-ep01-count.png` (checksums in evidence/LOG_CHECKSUMS.txt).

Repeatable runner (installed outside checkout; no lockfile/dependency change):

```sh
npm install --prefix /tmp/miniros-ep01-browser-runner playwright@1.58.2 --no-audit --no-fund
MINIROS_PLAYWRIGHT_MODULE=/tmp/miniros-ep01-browser-runner/node_modules/playwright \
MINIROS_CHROMIUM_PATH=/Users/emsi/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell \
node scripts/acceptance/ep01-browser.mjs
```

Use a locally installed Chromium executable for MINIROS_CHROMIUM_PATH on another
machine, or Playwright's installed browser with that variable omitted. Start the
opt-in development server first. The script always closes its fresh browser.

Final integration: root tests 53 domain, 106 contracts, 155 web (12 PG skipped),
41 workflow (4 HTTP skipped before local production server); zero test failures,
zero cached tasks. Echo-only tasks remain non-evidence. Final root typecheck and lint each passed 11/11 tasks with zero cache hits. Web production build passed (122 PWA assets). Local production HTTP suite passed 45/45; production route returned 404 even with MINIROS_V2_SKELETON=1. Both task servers were stopped.
Independent final gate: ACCEPTED. Reviewer accepted all EP01-T01–T05 after inspecting code, contracts, traceability and completed W evidence; final integration results recorded here. No outstanding findings. Generated tracked compiler cache restored to HEAD; no unrelated changes.
No migrations, dependency/lockfile changes, push, deployment or production writes.
Rollback: remove/disable only development route + its conceptual exports/consumers;
legacy schema/journals/routes stay usable. Do not force-switch an active shift.

Remaining gates: disposable multi-connection PostgreSQL not supplied; Android/iOS
hardware, native transport/storage, hosted auth/storage/realtime, QR camera/storage,
full-shift pilot and release authorization unverified. Legacy INC-001 remains open
for EP13; the skeleton does not fix booth operations. Stop before EP02/EP03 execution.

## Actual agent settings

Lead/integrator and independent reviewer used inherited session settings (no model
or effort override; exact inherited identifier is not exposed). Two actual audit
agents used supported `gpt-5.6-terra`, `medium`: repository_audit (read-only
repository/domain and traceability audits) and test_audit (read-only baseline test
audit, subsequently reused to implement the isolated UI files). Lead owned shared
contracts, integration, browser automation and evidence. Reviewer was separate and
read-only. At most three subagents ran concurrently.
