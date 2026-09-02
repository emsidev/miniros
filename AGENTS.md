# MINIROS Agent Instructions

## Product focus

MINIROS is a mobile-first retail operations system for pop-up sellers, booth sellers, bazaar sellers, kiosks, and small retail teams.

The MVP must focus on helping sellers answer:

- Did this selling location actually make money?
- Should I rent this location again?

## Build rules

- Keep the MVP focused on shift selling, inventory, production, closeout, and location profitability.
- Do not turn MVP features into full V1/V2 modules unless explicitly requested.
- Use clean, mobile-first routes for employees and operators.
- Operators are employees with POS access.
- Use role/permission checks instead of duplicating employee and operator route trees.
- Admin routes stay under `/admin`.
- Recipes belong under inventory.
- Promos have an admin page but should stay simple in MVP.

## Architecture rules

- Use Next.js App Router, TypeScript, Supabase, Drizzle ORM, Dexie, and PWA support.
- Use a code-first database approach with Drizzle schema modules under `src/db/schema`.
- Keep business logic out of React components.
- Keep business logic out of Supabase RPC/functions/stored procedures.
- Multi-step workflows must live in `src/server/actions` and `src/server/services`.
- Services must follow SRP.
- Use Drizzle transactions for critical workflows.
- Use Supabase for Auth, Postgres, Storage, RLS, and Realtime.
- Use RLS policies for data access.
- Use private Supabase Storage buckets for sensitive files such as payment proofs.

## Critical workflows

These workflows should be implemented as server-side transactions:

- Start shift
- Finalize sale
- Upload/link payment proof
- Log production
- Approve inventory adjustment
- Submit closeout
- Calculate shift profit
- Sync offline action

## Database rules

- Put `business_id` on operational tables.
- Use UUID primary keys.
- Support client-generated UUIDs for offline sync.
- Use soft deletion for important records.
- Use ledger-style inventory tables.
- Store snapshots for money values such as price, salary, cost, and profit.
- Do not use derived totals as the source of truth.
