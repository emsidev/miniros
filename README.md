# MINIROS

MINIROS means **Mini Retail Operations System**.

The repo now uses a `pnpm` + Turbo monorepo layout so the product surfaces can stay separate while business rules, contracts, and data access stay shared.

## Workspace shape

- `apps/web`: authenticated Next.js App Router product app
- `apps/site`: Astro marketing and documentation site
- `apps/mobile`: Expo mobile shell
- `apps/api`: typed API surface for shared workflows
- `apps/agent`: agent-facing utilities
- `apps/e2e`: end-to-end test workspace
- `packages/domain`: business rules, workflow catalog, permissions
- `packages/db`: Drizzle schema and DB access
- `packages/contracts`: shared request and response schemas
- `packages/sdk`: typed client helpers for app consumers
- `packages/ui`: shared copy and design tokens
- `packages/config`: shared ESLint and TypeScript presets

## Product rule

Business logic belongs in shared TypeScript packages and server-side services, not inside React components and not inside Supabase RPC business logic.

## Database changes after a refactor

Run `pnpm db:check` before starting the updated app. It checks the database's
columns and applied migration history without changing any data, using
`DATABASE_URL` or, if unset, `apps/web/.env.local`.

Review pending SQL migrations and confirm the target before applying them.
`pnpm db:migrate` applies migrations to the linked hosted Supabase project;
`pnpm db:migrate:local` targets the local Supabase database. The linked project
must match the app's database. Do not reset a database or delete offline journals
to resolve a missing-column error. Rerun `pnpm db:check` after migration.
