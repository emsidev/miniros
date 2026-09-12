# EP05 evidence — additive native backend

Local `dev` baseline `0056f316cf811f10f943d56c4c987b1642844938` plus this diff, 7 September 2026. Independent review accepts local PostgreSQL/HTTP implementation after a reproduced P1 reservation race was fixed. Hosted S gates remain blocked.

Implementation/API detail: EP05_BACKEND_REPORT.md. Independent acceptance: EP05_REVIEW_REPORT.md. Exact migration and safe rollback boundary: EP04_EP05_MIGRATIONS.md. No hosted migration, production mutation, push or deployment occurred.

## Implemented result

The existing Next server now has isolated native POST adapters for immutable snapshot/authority registration, owner/admin grants and revocation, signed cashier ingestion, signed prep commands and audited owner recovery evidence. Bearer identity uses live Supabase getUser with a stateless Auth-only client in the existing `lib/supabase` boundary. Cookie refresh is bypassed only for the exact native route prefix; web Origin/CSRF protections remain.

Shared v2 reduction, original operation/receipt, effect deltas, count seals, close manifests, consumed prep commands and contiguous high-water mark share a PostgreSQL transaction. Gaps/conflicts/invalid or expired/revoked work create separate authorized-scope incidents without effects or false completeness. Original authenticated receipts remain retrievable after grant expiry. Grant acceptance uses server time and a 24-hour maximum. New authority creation defaults off behind `MINIROS_NATIVE_V2_NEW_SHIFTS_ENABLED=1`; disabling it cannot strand accepted journals.

The ten additive raw tables enable RLS, deny PUBLIC/anon/authenticated/service_role access and are absent from Realtime. Composite foreign keys bind tenant, shift, authority, snapshot, grant, installation and journal references. Opening counts never debit central stock. Historical v1 envelopes retain their original parser, price and quantity behavior.

## Actual acceptance evidence

Tests ran on task-owned PostgreSQL 18.0 at `127.0.0.1:55432/miniros_ep00_disposable`, with independent simultaneous connection PIDs and actual lock waits. Supabase getUser is stubbed in-process for synthetic identities in I tests; crypto, schemas, services, reducers and SQL are real.

| ID       | I result                                                                                                                                                                                                  | Remaining S gate                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| EP05-T01 | PASSED: drop/ignore post-commit reply, retry, same original receipt and one effect, including authenticated receipt retrieval after expiry                                                                | Hosted HTTP/network behavior                                     |
| EP05-T02 | PASSED: sequence 3 before 2, occupied sequence and changed ID/body/digest retain gap/conflict evidence and original journal                                                                               | None for I                                                       |
| EP05-T03 | PASSED: cross-tenant routes/services, actual SET LOCAL ROLE raw reads, all-ten-table privileges/RLS/FKs, existing private Storage SQL policies and publication exclusions                                 | Hosted Auth/Data API/views/Storage/Realtime cross-tenant checks  |
| EP05-T04 | PASSED: invalid Bearer/brand/signature, prep/expired/revoked/wrong installation/epoch/snapshot/assignment/permission rejected; original authorized evidence retained                                      | Hosted token/revocation propagation and enrolled-device behavior |
| EP05-T05 | PASSED: real effects insert then injected failure before journal/receipt rolls back all effects; deferred orphan FK fails at commit                                                                       | None for I                                                       |
| EP05-T06 | PASSED: actual v1 opening/sale replay after migration, old price 500 despite live price 900, historic quantity 1.2346→1.235 and line total 618, original-reply dedup; unsupported v2 versions fail safely | None for I                                                       |
| EP05-T07 | PASSED: simultaneous real PostgreSQL ingestion with distinct PIDs creates one operation/effect; both legacy/native reservation race directions are tested with actual lock waits                          | None for I                                                       |

The final focused root command runs native author tests, independent review tests, the full golden SQLite→PostgreSQL integration and the existing data-access boundary: **40 passed in seven files, zero failures/skips**. Log: `evidence/ep05-native-final-tests.log`; simultaneous ingest PIDs 63731/63735 are recorded. Independent counts are **24 tests** across three files; backend author count is **14 tests**. These overlap the root total and must not be summed as additional unique coverage.

Earlier affected legacy checks passed 21 real PostgreSQL and eight embedded database tests after the additive migration. The full root golden test commits 19 operations locally while cloud remains at sequence zero, reopens SQLite, then delivers each operation twice. Final projections match, cloud pending is zero, peer pending remains 19, four media jobs remain independent, and the legacy central inventory ledger has no entries for the synthetic business.

## Review findings resolved

Independent P1: a legacy REPEATABLE READ transaction could wait for native registration and still miss its new authority because no shift row version changed. New native registration now updates the already-locked shift row in the same transaction. The native-first loser gets PostgreSQL 40001, writes no legacy session and sees the reservation on retry; the reverse loser gets LEGACY_RESERVED and writes no v2 authority. Both regressions assert distinct PIDs and wait_event_type=Lock.

Root aggregate review found native Auth client creation outside the repository's designated adapter directory. The factory moved to `lib/supabase/native.ts`, exposes only Auth, and is explicitly registered in the existing narrow boundary test. No relational-query exception or broad test waiver was added. The initial failure log is retained as `evidence/ep05-root-tests-first.log`; the affected 40-test suite then passed. Independent source review accepted the final factory.

## Environment and preservation

PostgreSQL was built from checksum-verified official source into a task-owned /tmp directory. All 16 prior migrations and the new additive migration ran against the disposable database only. Bootstrap SQL, migration log and schema no-diff generation check are under `evidence/`; preparation details are in EP05_BACKEND_PREPARATION.md. Rollback must retain the v1/v2 exclusion guards while any v2 authority exists; an unpatched pre-EP05 server is not a safe rollback for those reservations.

Native private-key enrollment/protection and automatic snapshot preparation are EP07 work. Financial prep-mirror encryption, transport integration and EP16 scanning/UI are not implemented by these persistence APIs. No plaintext financial readback is exposed to prep. Native compilation, physical phone matrix, hosted Supabase checks and pilot acceptance remain blocked or out of scope. This run stops after EP05.

## Final root gate

After the final Auth factory correction, root typecheck and lint each passed 11/11 fresh tasks. The production build passed (128 PWA assets); all six native unauthenticated routes returned403/no-store and the development route returned404. The full root run passed **627 tests with zero failures/skips** (domain110/contracts143/mobile123/web206/workflow45). Exact commands, build identity and log links are in SESSION_HANDOFF.md. Temporary web/PostgreSQL servers were stopped and retained data was preserved.
