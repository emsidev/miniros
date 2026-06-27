# MINIROS Database Design

## Approach

MINIROS uses a code-first database approach with Drizzle ORM.

Schema modules live in:

```txt
src/db/schema
```

Generated Drizzle migrations go to:

```txt
supabase/migrations/drizzle
```

Hand-written Supabase platform migrations for RLS, storage policies, and realtime live in:

```txt
supabase/migrations
```

## Important rule

Do not use Supabase RPC functions, stored procedures, or business-logic triggers for MVP workflows.

Use Next.js server actions and server services with Drizzle transactions.

## Design principles

- Put `business_id` on operational tables.
- Use UUID primary keys.
- Support client-generated UUIDs for offline sync.
- Use safe deletion with `deleted_at`.
- Use ledger-style inventory.
- Store historical money snapshots.
- Use RLS for data access.
- Enable realtime only on necessary operational tables.

## Schema groups

```txt
Auth and business access
Products and inventory
Locations and shifts
Sales and payments
Production
Deductions and approvals
Closeouts and profit
Offline sync
Files and audit logs
```

## Core tables

```txt
profiles
businesses
business_members
employees

product_categories
products
inventory_items
product_recipe_items

selling_locations
shifts
shift_assignments
shift_costs

inventory_locations
inventory_events
inventory_event_lines
inventory_balances
shift_inventory_counts

production_logs

sales
sale_items
payments
files

sale_change_requests
cash_deductions
inventory_adjustments

shift_closeouts
cash_reconciliations
shift_profit_summaries

offline_sync_actions
audit_logs
```

## Optional simple MVP tables

```txt
stock_receivings
stock_receiving_lines
stock_transfers
stock_transfer_lines
promo_rules
```

These tables support simple MVP workflows only. Full procurement, warehouse transfers, and advanced promo campaigns belong to later versions.

## Realtime tables

Enable realtime for tables that power live shift operations:

```txt
shifts
shift_assignments
sales
payments
production_logs
inventory_events
inventory_balances
cash_deductions
inventory_adjustments
shift_closeouts
offline_sync_actions
```

Do not enable realtime for static setup tables unless needed.
