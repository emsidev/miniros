# Redacted incident observations

## INC-001 — proof failure blocks subsequent financial upload

Status: **confirmed in isolated client-coordinator integration**, not a hosted incident
postmortem. Source baseline edbba0e4; test `lib/offline/sync.test.ts`, EP00-T03.
Real sync coordinator + Dexie with fake IndexedDB; HTTP responses injected, no network.
Given acknowledged opening and sale A, pending proof A, and queued sale B, a proof HTTP
503 produced calls `[status, proof]`, no financial upload for B. B remained pending,
proof retained its error, session became RETRY. All three actions and both sales
(total 40,000 minor units) remained locally stored. **No data loss observed.**

Cause observed: `uploadProofs()` rethrows into the enclosing session catch before
later actions. Current behavior is captured intentionally, not asserted desirable.
Later fix owner: EP13 attachment/financial separation, with EP10 local commit and
EP05 ingestion contracts. No production behavior was modified in EP00/EP01.

## Other risks (not confirmed user incidents)

Native two-phone delivery, physical cold restart, multi-connection PostgreSQL locking,
hosted token expiry/revocation, camera recovery, OS background behavior and full-shift
battery/soak are unverified gates. No supplied incident evidence establishes data loss,
duplicate money, or successful mixed-phone operation. The static Expo shell and
placeholder test scripts are directly inspected implementation gaps.
