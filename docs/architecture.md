# MINIROS Architecture

## Decision

MINIROS uses Next.js for application workflows and Supabase for platform services.

## App architecture

```txt
Browser / PWA
  -> Next.js App Router
  -> Server Actions / Route Handlers
  -> Server Services
  -> Drizzle ORM transactions
  -> Supabase Postgres
```

## Supabase usage

Use Supabase for:

- Auth
- Postgres
- Storage
- Row Level Security
- Realtime

Do not use Supabase for:

- RPC business workflows
- Stored procedure business workflows
- Business-logic triggers

## Business logic rule

Business logic must follow SRP and live in these folders:

```txt
src/server/actions
src/server/services
```

Server actions should be thin entry points.

Server services should contain reusable workflow logic.

## Critical transaction workflows

The following must run inside server-side database transactions:

- Start shift
- Finalize sale
- Link payment proof
- Log production
- Approve inventory adjustment
- Submit closeout
- Calculate shift profit
- Sync offline action

## Route decision

Use clean URLs for employee/operator workspace routes.

Operators are employees with POS permission.

Shared routes:

```txt
/schedule
/shifts
/shifts/[shiftId]
/shifts/[shiftId]/start
/shifts/[shiftId]/close
/inventory
/production
/profile
```

Operator-only route:

```txt
/pos
```

Admin routes:

```txt
/admin/dashboard
/admin/employees
/admin/products
/admin/inventory
/admin/inventory/items
/admin/inventory/recipes
/admin/production
/admin/locations
/admin/shifts
/admin/approvals
/admin/promos
/admin/reports
/admin/settings
```
