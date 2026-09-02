# MINIROS MVP Documentation

## Product name and positioning

**MINIROS** means **Mini Retail Operations System**.

MINIROS is a mobile-first retail operations system for pop-up sellers, booth sellers, bazaar sellers, kiosks, and small retail teams.

MINIROS helps business owners know if a booth or selling location is worth renting again.

It does not only track sales. It tracks the full operation of a selling shift so the owner can see the real profit or loss of every location.

## Core promise

MINIROS helps sellers answer:

- Did this location actually make money?
- Should I rent this location again?

## Locked stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth, Postgres, Storage, RLS, and Realtime
- Drizzle ORM and Drizzle Kit
- Dexie / IndexedDB
- PWA
- Vercel

## MVP goal

The MVP should allow a seller to:

1. Set up employees, products, inventory, recipes, locations, and shifts.
2. Assign employees to shifts.
3. Add expected location costs such as rent, transport, and other expenses.
4. Start a selling shift.
5. Sell products using a mobile-first POS.
6. Accept cash, non-cash, and split payments.
7. Upload payment proof for non-cash payments.
8. Track inventory deductions.
9. Log production.
10. Close the shift.
11. See gross sales, total costs, net revenue, and profit/loss.
12. Decide if the selling location is worth renting again.

## App areas

### Admin setup

Admin manages employees, roles, approvals, products, inventory, recipes, production, selling locations, shifts, costs, promos, closeouts, and reports.

### Employee/operator workspace

Employees and operators share clean workspace routes.

Operators are employees with POS permission.

Shared screens:

- Schedule
- Shifts
- Inventory
- Production
- Profile

Operator-only screen:

- POS

### Owner dashboard

Admin views sales, payments, inventory movement, production, staff cost, rent, transport, deductions, profit/loss, and location performance.

## Main actors

- Admin / Business Owner
- Employee
- Operator
- System

Customer is not an MVP actor because online ordering is not included in MVP.

## Core MVP features

- Single business workspace
- Employee management
- Basic roles
- Account approvals
- Safe deletion
- Product and category management
- Inventory items
- Recipes / BOM under inventory
- Production logging
- Recipe-based inventory deduction
- Selling locations
- Shifts
- Shift employee assignment
- Shift schedule calendar
- Active shift start
- Opening inventory
- POS cart
- Cash, non-cash, and split payments
- Payment proof upload
- Refund, void, and sale correction requests
- Inventory adjustment with logs
- Cash deduction with approval/logging
- Basic employee salary per shift
- Shift costs
- Shift closeout
- Cash reconciliation
- Sales summary
- Payment summary
- Inventory summary
- Profit/loss calculation
- Location profitability check
- Basic reports
- Offline/PWA transaction queue
- Audit logs

## Optional simple MVP features

- Simple stock receiving
- Simple stock transfer to shift/location
- Simple promo/discount rule

These must stay simple and must not become full V1 modules during MVP.

## Move to later

- Online orders
- Customer CRM
- Full supplier/procurement workflow
- Full purchase orders
- Full stock receiving module
- Full stock transfer module
- Full promo campaign management
- Tax/service charge settings
- Detailed permission matrix
- Multi-business support
- SaaS billing
- Advanced payroll
- Loyalty rewards
- Accounting exports
- External integrations
- Advanced offline conflict resolution

## Final pitch

**MINIROS helps pop-up sellers know which booths are worth renting again.**

It tracks sales, payments, inventory, staff costs, rent, transport, deductions, and closeout data so business owners can see the real profit or loss of every selling location.

## Tagline

**Track profit, not just sales.**
