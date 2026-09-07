# Source register and review boundaries

**Prepared:** 7 September 2026. **Repository:** `emsidev/miniros`.
**Reference branch:** `main` at `d073cbbc0f78bf2e9142a663a70009c60158c8a1`, rechecked through the connected GitHub tool for this plan.

This is an implementation specification. No application code was changed, no database was mutated, and no Miniros runtime/device test was executed while preparing it. Plan-file consistency and fixture arithmetic checks are not app validation. EP00 must inspect the actual checkout, including a newer branch or local edits.

## Repository evidence

| ID | Source at the reference commit | Observed implication |
|---|---|---|
| R1 | `main` branch metadata | Reference SHA matches the earlier review. This is not permission to reset a newer checkout. |
| R2 | `README.md` | Next.js web, Expo mobile shell, API/e2e and shared domain/contracts/db workspaces already exist. Shared TypeScript/server business rules are an explicit repository rule. |
| R3 | root `package.json` | pnpm 10.2.1; real root typecheck/lint/test/e2e/build scripts; `db:migrate` invokes `supabase db push`. Inspect destination before any migration command. |
| R4 | `apps/mobile/package.json` | `test` is `echo No mobile tests yet`; `build` is `expo export --platform web`. Neither proves native tests/builds. |
| R5 | `apps/e2e/package.json` | `test` is `vitest run`, with fake-indexeddb/PGlite dependencies; not itself a physical phone automation suite. |
| R6 | `docs/offline-acceptance.md` | Prior automated/browser checks are recorded, with real phone, hosted auth/storage and other acceptance gaps explicitly pending. Those historical results were not rerun here. |
| R7 | earlier `MINIROS_Reliability_Plan.md` and conversation review | Earlier source observations identify useful Dexie/server replay invariants and a candidate attachment-blocking sync path. Reproduce the candidate before claiming it caused operational failures. Older owner-allocated stock/menu requirements are superseded by this pack. |

Repository URLs for exact-source retrieval:

```text
https://api.github.com/repos/emsidev/miniros/branches/main
https://github.com/emsidev/miniros/blob/d073cbbc0f78bf2e9142a663a70009c60158c8a1/README.md
https://github.com/emsidev/miniros/blob/d073cbbc0f78bf2e9142a663a70009c60158c8a1/package.json
https://github.com/emsidev/miniros/blob/d073cbbc0f78bf2e9142a663a70009c60158c8a1/apps/mobile/package.json
https://github.com/emsidev/miniros/blob/d073cbbc0f78bf2e9142a663a70009c60158c8a1/apps/e2e/package.json
https://github.com/emsidev/miniros/blob/d073cbbc0f78bf2e9142a663a70009c60158c8a1/docs/offline-acceptance.md
```

## Primary technical references checked

| ID | Reference | Narrow fact used |
|---|---|---|
| S1 | OpenAI Codex subagents documentation | Explicit subagent delegation is supported in current clients; simultaneous code edits need coordination. The pack's roles/concurrency limit are proposed project rules. |
| S2 | OpenAI `AGENTS.md` documentation | Codex reads layered instruction files and bounds their total size. Use a concise pointer, not the entire plan as root instructions. |
| S3 | Expo SQLite documentation | Native SQLite persistence/transaction APIs are available. API details depend on the installed version and do not replace crash/device tests. |
| S4 | Google Nearby Connections overview | Native direct offline communication is a candidate capability. This is not proof that Miniros or any wrapper supports the required phones reliably. |
| S5 | Supabase Realtime troubleshooting | Realtime events are not guaranteed delivery; use authoritative queries/reconciliation for important state. |
| S6 | Supabase securing-data documentation | Client secrets/service-role exposure is unsafe; exposed data requires appropriate authorization/grants/RLS. |

```text
S1 https://developers.openai.com/codex/subagents
S2 https://developers.openai.com/codex/agent-configuration/agents-md
S3 https://docs.expo.dev/versions/latest/sdk/sqlite/
S4 https://developers.google.com/nearby/connections/overview
S5 https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting
S6 https://supabase.com/docs/guides/database/secure-data
```

All workflow defaults, task sequencing, targets and tests are proposed implementation requirements based on the user's stated needs. They are not measurements of the existing app or guarantees of zero failure. Validate installed library/platform versions at implementation time; do not perform unrelated mass upgrades to match latest documentation.
