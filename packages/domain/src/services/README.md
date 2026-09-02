# Server Services

Server services contain reusable business logic and must follow SRP.

Server actions should call services. Services should call repositories or Drizzle transactions.

Do not put MVP business workflows in Supabase RPC functions, stored procedures, or business-logic triggers.

## Critical services

- `pos` finalizes sales and payments.
- `inventory` posts inventory ledger events and balances.
- `shifts` starts and closes shifts.
- `production` logs production and recipe/BOM usage.
- `closeouts` submits closeouts and reconciliation.
- `profit` calculates shift/location profit snapshots.
- `offline` syncs offline actions idempotently.
- `audit` writes audit log records.
