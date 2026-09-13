# Database refactor repair — 12 September 2026

Target: the hosted Supabase project `nhfefkpmijcrncjpqity`, confirmed to match
the web app's configured database. Source: the existing dirty `dev` working tree.
This is a database compatibility repair, not application deployment or native
pilot acceptance.

The admin shift query failed because `shifts.opening_cash_cents` was absent.
Migration history showed four pending migrations. After read-only preflight and
independent SQL review, the existing migrations were applied in order:

- `20260905065933_centralized_schedule.sql`
- `20260905071237_security_server_write_boundaries.sql`
- `20260907143003_native_v2_persistence.sql`
- `20260912114907_bored_malcolm_colcord.sql`

The command was `PGOPTIONS='-c lock_timeout=5s -c statement_timeout=60s' pnpm exec
supabase db push --linked --skip-vault --yes`. No reset, seed import, historical
migration rewrite, or offline-journal deletion was performed.

Verification:

- `pnpm db:check` passes against the app database; no pending migrations or
  missing code-defined columns remain.
- The exact previously failing Drizzle admin-shifts query succeeds: four rows.
- Opening cash is non-null, defaults to zero, and has a validated nonnegative
  check. Product stock mapping is nullable with a validated tenant-scoped FK.
- All ten v2 tables have RLS, no raw PUBLIC/anon/authenticated/service_role
  grants, and no Realtime publication entries. The effects FK remains deferred.
- Before/after counts match: 11 shifts, 15 products, 4 sales, 1 offline sync
  action, 3 offline shift sessions, and 4 inventory events.
- Focused schema/schedule/inventory tests: 18 passed, 4 optional PostgreSQL
  cases skipped because `SHIFT_TEST_DATABASE_URL` was not provided. The hosted
  verification above was read-only; no test fixtures were inserted there.
- DB and web typechecks, check-script typecheck, affected-file lint, and
  `git diff --check` pass. Drizzle generation reports no schema changes.
- Hosted security advisors report one Auth warning: leaked-password protection
  is disabled. No database security errors were reported.

The new `pnpm db:check` command is read-only and has four regression tests,
including safe handling of malformed URLs without logging credentials.
The other pasted errors concern stale Server Actions and invalid refresh tokens;
database migration does not repair an old browser session. Reload the updated
app and sign in again, without clearing unsynchronized device journals.
