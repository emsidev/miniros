# Offline workflow verification

Run `corepack pnpm e2e` from the monorepo root. This workspace exercises the actual transactional offline services using disposable PostgreSQL/PGlite data and includes the Dexie and service worker fault suites next to their implementation.

For the production HTTP tests, first build/start the web app and run:

```sh
MINIROS_PREVIEW_URL=http://localhost:3100 corepack pnpm e2e
```

No hosted data is needed or changed. Auth is mocked at the service boundary; Storage is an in-memory byte store in the proof recovery case. These tests do not replace a hosted Supabase session, real Storage or multi-connection PostgreSQL/device testing. See [the acceptance record](../../docs/offline-acceptance.md) for observed browser checks and the required physical Android/iPhone run.
