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
