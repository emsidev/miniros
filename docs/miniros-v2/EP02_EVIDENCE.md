# EP02 evidence — provisional native connectivity spike

Source: local `/Users/emsi/Documents/ChatGPT/MINIROS/miniros`, `dev` at
`0056f316cf811f10f943d56c4c987b1642844938` plus this run's uncommitted EP02 files.
Date: 7 September 2026. Node24.19.0, Expo57.0.20, React Native0.86.3,
SQLite3.53.3 for portable tests. This is a synthetic test-message protocol, not
the v2 financial journal or production staff enrollment.

## Implemented boundary

The isolated Expo module wraps Google's Nearby Connections for native Android/iOS.
Explicit in-person code confirmation is required alongside tenant/shift/snapshot/
epoch/role/device/test-group scope matching. The link carries numbered orders and
return commands; no Supabase or internet WebSocket implementation carries it.
Nearby remains a **candidate**, not an approved production runtime.

A replaceable transport sits behind the session protocol. SQLite commits the inbox
and original receipt before the session emits an acknowledgement. Sender work stays
durable until a matching receipt commits. Same-ID/different-payload and sequence
conflicts are rejected, gaps are bounded, duplicates do not repeat the new-message
callback, and a retry timer drains retained work after pairing. Background cleanup
stops discovery and leaves honest pending state. Manual reconnect compares a fresh
code. No immediate/background delivery guarantee is made.

The flag `EXPO_PUBLIC_MINIROS_EP02_SPIKE=1` selects a separate native spike identity
and screen. Default application flow is preserved. Native run scripts request a
Release JS bundle for offline cold-start testing. SQLite file `miniros-ep02-spike.db`
holds synthetic data only; no legacy journal is opened or erased.

## Commands and actual results

| Command                                                                                                                                         | Result                                       | Evidence level / limitation                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- |
| `corepack pnpm --filter @miniros/mobile exec expo install --check`                                                                              | Passed                                       | Installed packages match the local Expo bundled compatibility list            |
| `corepack pnpm --filter @miniros/mobile typecheck`                                                                                              | Passed                                       | TypeScript only                                                               |
| `corepack pnpm --filter @miniros/mobile lint`                                                                                                   | Passed                                       | Source lint                                                                   |
| `corepack pnpm --filter @miniros/mobile test:ep02`                                                                                              | 69 passed,0 failed,0 skipped                 | Real temp-file SQLite + simulated transport; U/I                              |
| `CI=1 corepack pnpm --filter @miniros/mobile native:prebuild`                                                                                   | Passed                                       | Generated Android/iOS native projects; no native compiler or pod installation |
| `corepack pnpm --filter @miniros/mobile exec expo-modules-autolinking resolve --platform android --json`                                        | MinirosPeer found                            | Native module discovery only                                                  |
| Same autolinking command with `--platform apple`                                                                                                | MinirosPeer pod/class found                  | Native module discovery only                                                  |
| `EXPO_PUBLIC_MINIROS_EP02_SPIKE=1 corepack pnpm --filter @miniros/mobile exec expo export --platform all --output-dir /tmp/miniros-ep02-export` | Android/iOS Hermes and web bundles generated | JS bundles, **not** native binaries/device evidence                           |
| `corepack pnpm --filter @miniros/mobile native:check:android`                                                                                   | BLOCKED,exit2                                | Missing Java runtime/JDK and Android SDK/adb                                  |
| `corepack pnpm --filter @miniros/mobile native:check:ios`                                                                                       | BLOCKED,exit2                                | Missing full Xcode and CocoaPods; signing/device access unverified            |

Raw local logs: `evidence/ep02-{typecheck,lint,tests,prebuild,js-bundles,native-android,native-ios}.log`.
Native dependency references/build-hook checks are in EP02_NATIVE_REPORT.md.
Independent exact assertions and findings are in EP02_REVIEW_REPORT.md.

## Acceptance mapping

| ID       | Available result                                                                        | Remaining exact gate                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| EP02-T01 | Scope/SAS rejection tested in portable harness                                          | BLOCKED D: pair all four installed native phone combinations with WAN disabled independently                                                         |
| EP02-T02 | PASSED I: lost receipt, restart, identical original receipt, no duplicate callback      | BLOCKED D: receiver persistence/retry on actual phones                                                                                               |
| EP02-T03 | Portable disconnect/background/cleanup and retained pending work passed                 | BLOCKED D: radio toggles, lock, app kill and resume on both OSes                                                                                     |
| EP02-T04 | PASSED I: malformed, oversized UTF-8, wrong scope/role, conflicts, bounded reorder/gaps | BLOCKED D: native packet path on supported phone matrix                                                                                              |
| EP02-T05 | Injected permission denial/retry passed; manual-code recovery is implemented            | BLOCKED D: actual OS Nearby/Bluetooth/local-network permission denial/regrant. Camera is absent from this manual-code spike and has no test evidence |
| EP02-T06 | Timing instrumentation exists; no physical samples collected                            | BLOCKED D:100+ physical operations, p95/max, payload envelope and reconnect measurements                                                             |

Follow EP02_DEVICE_RUNBOOK.md for Android/Android, iPhone/iPhone and both mixed roles.
Simulator, browser and mocked transport results cannot replace any D row.

## Review, design and preservation

The independent agent accepted portable code and native source for development after
fixes to one P1 scope bypass and four P2 session/native lifecycle issues. The root
reran the mobile checks. G1 remains BLOCKED until compiled native builds and physical
security/failure evidence are independently accepted.

Impeccable Operate/native guidance and Emil's interaction guidance inform the small
test screen: inherited Miniros colors, safe areas, scalable text, at least48px targets,
clear pressed/disabled/error states and no decorative animation. Frontend taste
explicitly excludes native operations UI. Rams source review reported95/100 with no
critical findings. Its two detailed hierarchy/spacing findings were fixed and
independently verified in source. Rams verify_fixes did not recognize those changes;
its response is not recorded as an all-clear. The reported two moderate issues had no actionable details in the response.
Native visual verification is BLOCKED without a simulator/device; no web screenshot
or HTML/CSS detector is treated as native visual evidence.

Rollback disables the explicit spike flag and preserves the synthetic SQLite file.
Generated native projects can be regenerated from the tracked module/config; no
legacy Dexie/SQLite/PostgreSQL records were migrated by EP02. Dependency changes are
additive, matched to the existing Expo version. No branch switch, remote operation,
commit, deployment, production mutation or data cleanup was performed.

Next authorized work after this portable checkpoint is EP03. It may proceed under
the plan's portable-development exception while G1 remains blocked. EP06+ and release
work remain out of scope.
